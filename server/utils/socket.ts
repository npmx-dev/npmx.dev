import type {
  OsvSeverityLevel,
  SecuritySourceStatus,
  SupplyChainAlert,
  SupplyChainAlertType,
  VulnerabilityReachability,
} from '#shared/types/dependency-analysis'
import { getSocketPackageUrl } from '#shared/utils/security-sources'
import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'

const SOCKET_PURL_BATCH_LIMIT = 1024

// A published package@version is immutable, so its Socket findings are stable
// enough to cache for a day. This is the main quota lever: the batch-purl
// endpoint bills a flat 100 units per request regardless of how many purls it
// carries, so caching per purl means overlapping and revisited trees reuse
// results and only never-before-seen versions cost a request.
const SOCKET_PURL_CACHE_PREFIX = 'socket-purl:v1:'
const SOCKET_PURL_CACHE_TTL_MS = CACHE_MAX_AGE_ONE_DAY * 1000

// a stalled Socket connection would otherwise block the vulnerabilities
// request until the platform limit fires; degrade to the failed path instead
const SOCKET_FETCH_TIMEOUT_MS = 10_000

/**
 * How long to stop calling the Socket API after a quota/authorization
 * rejection (429/403), so a public traffic spike can't burn through quota
 * with doomed requests.
 */
const SOCKET_COOLDOWN_MS = 10 * 60 * 1000

/**
 * Socket alert types that map to vulnerability findings, with a fallback
 * description for the types whose alerts carry no advisory title (notably
 * potentialVulnerability, Socket's pending-review signal, which has no
 * GHSA/CVE/title at all). Fallback text mirrors Socket's own alert-type
 * descriptions (https://api.socket.dev/v0/alert-types).
 */
const VULNERABILITY_ALERT_DESCRIPTIONS: Record<string, string> = {
  criticalCVE: 'Contains a critical CVE',
  cve: 'Contains a high severity CVE',
  mediumCVE: 'Contains a medium severity CVE',
  mildCVE: 'Contains a low severity CVE',
  potentialVulnerability:
    'Socket review suggests a possible vulnerability in this package, pending further analysis',
}

/**
 * Curated allowlist of Socket supply-chain alert types surfaced by npmx.
 * Deliberately conservative: only high-signal, consumer-relevant risks.
 * npmx queries Socket policy-neutrally (no `actions` filter) and applies
 * this allowlist itself.
 */
const SUPPLY_CHAIN_ALERT_TYPES = new Set<SupplyChainAlertType>([
  'malware',
  'gptMalware',
  'didYouMean',
  'gptDidYouMean',
  'troll',
  'obfuscatedFile',
  'manifestConfusion',
  'installScripts',
  'telemetry',
  'unstableOwnership',
])

interface SocketAlert {
  key?: string
  type?: string
  severity?: string
  category?: string
  props?: Record<string, unknown>
}

interface SocketArtifact {
  type?: string
  name?: string
  namespace?: string
  version?: string
  alerts?: SocketAlert[]
  alertKeysToReachabilityTypes?: Record<string, string[]>
}

/** A vulnerability finding from Socket, normalized for merging with OSV data */
export interface SocketVulnerabilityFinding {
  /** Best available identifier: GHSA id, CVE id, or a synthetic socket id */
  id: string
  ghsaId?: string
  cveId?: string
  summary: string
  severity: OsvSeverityLevel
  fixedIn?: string
  reachability?: VulnerabilityReachability
  url: string
}

/** Result of scanning a dependency tree via the Socket batch purl API */
export interface SocketTreeScan {
  status: SecuritySourceStatus
  /** `name@version` -> vulnerability findings */
  vulnerabilities: Map<string, SocketVulnerabilityFinding[]>
  /** `name@version` -> supply-chain alerts */
  supplyChainAlerts: Map<string, SupplyChainAlert[]>
}

function emptyScan(status: SecuritySourceStatus): SocketTreeScan {
  return { status, vulnerabilities: new Map(), supplyChainAlerts: new Map() }
}

function getSocketConfig(): { apiKey: string; orgSlug: string } | null {
  const { socket } = useRuntimeConfig()
  if (!socket?.apiKey || !socket?.orgSlug) return null
  return { apiKey: socket.apiKey, orgSlug: socket.orgSlug }
}

/** Circuit breaker state: timestamp until which Socket calls are suspended */
let socketUnavailableUntil = 0

/** Build a package-url for an npm package (scopes are percent-encoded) */
export function toNpmPurl(name: string, version: string): string {
  if (name.startsWith('@')) {
    const slashIndex = name.indexOf('/')
    const scope = name.slice(0, slashIndex)
    const base = name.slice(slashIndex + 1)
    return `pkg:npm/${encodeURIComponent(scope)}/${base}@${version}`
  }
  return `pkg:npm/${name}@${version}`
}

/** Map a Socket severity string onto the shared severity scale */
function normalizeSocketSeverity(severity: string | undefined): OsvSeverityLevel {
  switch (severity) {
    case 'critical':
      return 'critical'
    case 'high':
      return 'high'
    // the Socket API schema has used both spellings
    case 'medium':
    case 'middle':
      return 'moderate'
    case 'low':
      return 'low'
    default:
      return 'unknown'
  }
}

function normalizeReachability(value: unknown): VulnerabilityReachability | undefined {
  if (value === 'reachable' || value === 'maybe_reachable' || value === 'unreachable') {
    return value
  }
  if (value === 'maybeReachable') return 'maybe_reachable'
  return undefined
}

/** Strongest verdict wins: reachable > maybe_reachable > unreachable */
const REACHABILITY_PRIORITY: VulnerabilityReachability[] = [
  'reachable',
  'maybe_reachable',
  'unreachable',
]

/** Pick the stronger (more alarming) of two reachability verdicts */
export function strongerReachability(
  a: VulnerabilityReachability | undefined,
  b: VulnerabilityReachability | undefined,
): VulnerabilityReachability | undefined {
  if (!a) return b
  if (!b) return a
  return REACHABILITY_PRIORITY.indexOf(a) <= REACHABILITY_PRIORITY.indexOf(b) ? a : b
}

function extractReachability(
  alert: SocketAlert,
  artifact: SocketArtifact,
): VulnerabilityReachability | undefined {
  const direct = normalizeReachability(alert.props?.reachability)
  if (direct) return direct

  const keyed = alert.key ? artifact.alertKeysToReachabilityTypes?.[alert.key] : undefined
  if (Array.isArray(keyed)) {
    const normalized = new Set(
      keyed
        .map(entry => normalizeReachability(entry))
        .filter((entry): entry is VulnerabilityReachability => entry !== undefined),
    )
    for (const level of REACHABILITY_PRIORITY) {
      if (normalized.has(level)) return level
    }
  }

  return undefined
}

function artifactPackageName(artifact: SocketArtifact): string | null {
  if (!artifact.name) return null
  if (!artifact.namespace) return artifact.name
  const scope = artifact.namespace.startsWith('@') ? artifact.namespace : `@${artifact.namespace}`
  return `${scope}/${artifact.name}`
}

/** Return the value when it is a non-empty string, else undefined */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

function toVulnerabilityFinding(
  alert: SocketAlert,
  artifact: SocketArtifact,
  packageName: string,
): SocketVulnerabilityFinding {
  const props = alert.props ?? {}
  const ghsaId = nonEmptyString(props.ghsaId)
  const cveId = nonEmptyString(props.cveId)
  const id = ghsaId ?? cveId ?? `SOCKET-${alert.key ?? alert.type ?? 'unknown'}`

  let url = getSocketPackageUrl(packageName)
  if (ghsaId) url = `https://github.com/advisories/${ghsaId}`
  else if (cveId) url = `https://nvd.nist.gov/vuln/detail/${cveId}`

  return {
    id,
    ghsaId,
    cveId,
    summary:
      nonEmptyString(props.title) ??
      (alert.type ? VULNERABILITY_ALERT_DESCRIPTIONS[alert.type] : undefined) ??
      'No description available',
    severity: normalizeSocketSeverity(alert.severity),
    fixedIn: nonEmptyString(props.firstPatchedVersionIdentifier),
    reachability: extractReachability(alert, artifact),
    url,
  }
}

function isSupplyChainAlertType(type: string | undefined): type is SupplyChainAlertType {
  return !!type && SUPPLY_CHAIN_ALERT_TYPES.has(type as SupplyChainAlertType)
}

/** Parse a batch purl response body: ndjson lines or a JSON array */
function parseArtifacts(raw: unknown): SocketArtifact[] {
  if (Array.isArray(raw)) return raw as SocketArtifact[]
  if (raw && typeof raw === 'object') return [raw as SocketArtifact]
  if (typeof raw !== 'string' || !raw.trim()) return []

  const text = raw.trim()
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const artifacts: SocketArtifact[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      artifacts.push(JSON.parse(trimmed))
    } catch {
      // skip a malformed/truncated ndjson line rather than discarding the
      // whole chunk's already-parsed artifacts (up to 1024 packages)
    }
  }
  return artifacts
}

function isQuotaOrAuthError(error: unknown): boolean {
  const { status, statusCode } = (error ?? {}) as { status?: number; statusCode?: number }
  const code = status ?? statusCode
  return code === 429 || code === 403
}

interface PackageRef {
  name: string
  version: string
}

/** Vulnerability + supply-chain findings for a single package@version */
interface PurlFindings {
  vulnerabilities: SocketVulnerabilityFinding[]
  supplyChainAlerts: SupplyChainAlert[]
}

interface CachedPurlEntry {
  findings: PurlFindings
  storedAt: number
}

/** Split a tree into cached per-purl findings and the purls still to fetch.
 * A cache-storage outage must not fail the scan, so it degrades to all-misses
 * (Socket is queried directly) rather than propagating the error. */
async function readPurlCache(
  packages: PackageRef[],
): Promise<{ hits: Map<string, PurlFindings>; misses: PackageRef[] }> {
  const hits = new Map<string, PurlFindings>()
  let entries: Array<{ value: unknown }>
  try {
    entries = await useStorage('cache').getItems(
      packages.map(pkg => SOCKET_PURL_CACHE_PREFIX + `${pkg.name}@${pkg.version}`),
    )
  } catch (error) {
    // oxlint-disable-next-line no-console -- log cache read failures for debugging
    console.warn('[socket] purl cache read failed, treating every purl as a miss:', error)
    return { hits, misses: [...packages] }
  }

  const misses: PackageRef[] = []
  const now = Date.now()
  entries.forEach((entry, i) => {
    const pkg = packages[i]!
    const cached = entry.value as CachedPurlEntry | null
    if (cached && now - cached.storedAt < SOCKET_PURL_CACHE_TTL_MS) {
      hits.set(`${pkg.name}@${pkg.version}`, cached.findings)
    } else {
      misses.push(pkg)
    }
  })
  return { hits, misses }
}

/** Persist freshly-fetched findings, including the empty results for
 * alert-free packages so they are not re-queried on the next tree. A write
 * failure is swallowed so it can't discard findings already normalized. */
async function writePurlCache(findings: Map<string, PurlFindings>): Promise<void> {
  const storedAt = Date.now()
  try {
    await useStorage('cache').setItems(
      Array.from(findings, ([key, value]) => {
        const entry: CachedPurlEntry = { findings: value, storedAt }
        return { key: SOCKET_PURL_CACHE_PREFIX + key, value: entry }
      }),
    )
  } catch (error) {
    // oxlint-disable-next-line no-console -- log cache write failures for debugging
    console.warn('[socket] purl cache write failed:', error)
  }
}

/** Accumulate normalized findings from parsed artifacts into a per-purl map */
function collectFindings(artifacts: SocketArtifact[], into: Map<string, PurlFindings>): void {
  for (const artifact of artifacts) {
    const name = artifactPackageName(artifact)
    if (!name || !artifact.version || !artifact.alerts?.length) continue
    const key = `${name}@${artifact.version}`
    const entry = into.get(key) ?? { vulnerabilities: [], supplyChainAlerts: [] }

    for (const alert of artifact.alerts) {
      if (alert.type && Object.hasOwn(VULNERABILITY_ALERT_DESCRIPTIONS, alert.type)) {
        entry.vulnerabilities.push(toVulnerabilityFinding(alert, artifact, name))
      } else if (isSupplyChainAlertType(alert.type)) {
        // The same alert type can fire for multiple files; surface it once
        if (!entry.supplyChainAlerts.some(existing => existing.type === alert.type)) {
          entry.supplyChainAlerts.push({
            type: alert.type,
            severity: normalizeSocketSeverity(alert.severity),
            url: getSocketPackageUrl(name),
            sources: ['socket'],
          })
        }
      }
    }
    into.set(key, entry)
  }
}

function applyFindings(scan: SocketTreeScan, key: string, findings: PurlFindings): void {
  if (findings.vulnerabilities.length) scan.vulnerabilities.set(key, findings.vulnerabilities)
  if (findings.supplyChainAlerts.length) scan.supplyChainAlerts.set(key, findings.supplyChainAlerts)
}

/**
 * Query the Socket batch purl API for a dependency tree and normalize the
 * results, caching per package@version (see SOCKET_PURL_CACHE_TTL_MS) so that
 * overlapping and revisited trees reuse findings and only never-before-seen
 * versions cost an API request.
 *
 * Policy-neutral: no `actions` filter is sent; npmx curates alert types via
 * its own allowlists. Degrades gracefully: `unconfigured` without an API key,
 * `unavailable` while the quota circuit breaker is open, `failed`/`partial`
 * on request errors.
 *
 * @see https://docs.socket.dev/reference/batchpackagefetchbyorg
 */
export async function querySocketForTree(packages: PackageRef[]): Promise<SocketTreeScan> {
  const config = getSocketConfig()
  if (!config) return emptyScan('unconfigured')
  if (packages.length === 0) return emptyScan('ok')

  const { hits, misses } = await readPurlCache(packages)
  const scan = emptyScan('ok')
  for (const [key, findings] of hits) applyFindings(scan, key, findings)

  if (misses.length === 0) return scan
  if (Date.now() < socketUnavailableUntil) {
    // cached findings still stand, but the misses can't be refreshed right now
    scan.status = hits.size > 0 ? 'partial' : 'unavailable'
    return scan
  }

  const fetched = new Map<string, PurlFindings>()
  let succeededChunks = 0
  let quotaExhausted = false

  const chunks: PackageRef[][] = []
  for (let i = 0; i < misses.length; i += SOCKET_PURL_BATCH_LIMIT) {
    chunks.push(misses.slice(i, i + SOCKET_PURL_BATCH_LIMIT))
  }

  for (const chunk of chunks) {
    try {
      const raw = await $fetch(
        `https://api.socket.dev/v0/orgs/${encodeURIComponent(config.orgSlug)}/purl?alerts=true`,
        {
          method: 'POST',
          timeout: SOCKET_FETCH_TIMEOUT_MS,
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            accept: 'application/x-ndjson',
          },
          // no compact=true: compact responses strip alert props (ghsaId,
          // cveId, title, reachability), which merging and the UI depend on
          body: {
            components: chunk.map(pkg => ({ purl: toNpmPurl(pkg.name, pkg.version) })),
          },
          responseType: 'text',
        },
      )

      // seed every requested purl so alert-free packages are cached too (and
      // therefore skipped next time), then fill in whatever the response held
      const chunkFindings = new Map<string, PurlFindings>()
      for (const pkg of chunk) {
        chunkFindings.set(`${pkg.name}@${pkg.version}`, {
          vulnerabilities: [],
          supplyChainAlerts: [],
        })
      }
      collectFindings(parseArtifacts(raw), chunkFindings)
      for (const [key, findings] of chunkFindings) {
        fetched.set(key, findings)
        applyFindings(scan, key, findings)
      }

      succeededChunks++
    } catch (error) {
      if (isQuotaOrAuthError(error)) {
        quotaExhausted = true
        socketUnavailableUntil = Date.now() + SOCKET_COOLDOWN_MS
        // oxlint-disable-next-line no-console -- log Socket quota exhaustion
        console.warn('[socket] quota/authorization error, suspending Socket queries:', error)
        break
      }
      // oxlint-disable-next-line no-console -- log Socket API failures for debugging
      console.warn('[socket] batch purl query failed:', error)
    }
  }

  if (fetched.size > 0) await writePurlCache(fetched)

  if (succeededChunks === chunks.length) {
    scan.status = 'ok'
  } else if (succeededChunks > 0 || hits.size > 0) {
    scan.status = 'partial'
  } else {
    scan.status = quotaExhausted ? 'unavailable' : 'failed'
  }
  return scan
}
