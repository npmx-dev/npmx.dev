import type { ProvenanceDetails } from '#shared/types'

const SLSA_PROVENANCE_V1 = 'https://slsa.dev/provenance/v1'
const SLSA_PROVENANCE_V0_2 = 'https://slsa.dev/provenance/v0.2'

const PROVIDER_IDS: Record<string, { provider: string; providerLabel: string }> = {
  'https://github.com/actions/runner/github-hosted': {
    provider: 'github',
    providerLabel: 'GitHub Actions',
  },
  'https://github.com/actions/runner': { provider: 'github', providerLabel: 'GitHub Actions' },
}

/** GitLab uses project-specific builder IDs: https://gitlab.com/<path>/-/runners/<id> */
function getProviderInfo(builderId: string): { provider: string; providerLabel: string } {
  const exact = PROVIDER_IDS[builderId]
  if (exact) return exact
  if (builderId.includes('gitlab.com') && builderId.includes('/runners/'))
    return { provider: 'gitlab', providerLabel: 'GitLab CI' }
  return { provider: 'unknown', providerLabel: builderId ? 'CI' : 'Unknown' }
}

const SIGSTORE_SEARCH_BASE = 'https://search.sigstore.dev'

/** SLSA provenance v1 predicate; optional v0.2 fields for fallback */
interface SlsaPredicate {
  buildDefinition?: {
    externalParameters?: {
      workflow?: {
        repository?: string
        path?: string
        ref?: string
      }
    }
    resolvedDependencies?: Array<{
      uri?: string
      digest?: { gitCommit?: string }
    }>
  }
  runDetails?: {
    builder?: { id?: string }
    metadata?: { invocationId?: string }
  }
  /** v0.2 */
  builder?: { id?: string }
  /** v0.2 */
  metadata?: { buildInvocationId?: string }
}

interface AttestationItem {
  predicateType?: string
  bundle?: {
    dsseEnvelope?: { payload?: string }
    verificationMaterial?: {
      tlogEntries?: Array<{ logIndex?: string }>
    }
  }
}

export interface NpmAttestationsResponse {
  attestations?: AttestationItem[]
}

function decodePayload(
  payloadBase64: string | undefined,
): { predicateType?: string; predicate?: SlsaPredicate } | null {
  if (!payloadBase64 || typeof payloadBase64 !== 'string') return null
  try {
    const decoded = Buffer.from(payloadBase64, 'base64').toString('utf-8')
    return JSON.parse(decoded) as { predicateType?: string; predicate?: SlsaPredicate }
  } catch {
    return null
  }
}

function repoUrlToCommitUrl(repository: string, sha: string): string {
  const normalized = repository.replace(/\/$/, '').replace(/\.git$/, '')
  if (normalized.includes('github.com')) return `${normalized}/commit/${sha}`
  if (normalized.includes('gitlab.com')) return `${normalized}/-/commit/${sha}`
  return `${normalized}/commit/${sha}`
}

function repoUrlToBlobUrl(repository: string, path: string, ref = 'main'): string {
  const normalized = repository.replace(/\/$/, '').replace(/\.git$/, '')
  if (normalized.includes('github.com')) return `${normalized}/blob/${ref}/${path}`
  if (normalized.includes('gitlab.com')) return `${normalized}/-/blob/${ref}/${path}`
  return `${normalized}/blob/${ref}/${path}`
}

/**
 * Parse npm attestations API response into ProvenanceDetails.
 * Prefers SLSA provenance v1; falls back to v0.2 for provider label and ledger only (no source commit/build file from v0.2).
 * @public
 */
export function parseAttestationToProvenanceDetails(response: unknown): ProvenanceDetails | null {
  const body = response as NpmAttestationsResponse
  const list = body?.attestations
  if (!Array.isArray(list)) return null

  const slsaAttestation =
    list.find(a => a.predicateType === SLSA_PROVENANCE_V1) ??
    list.find(a => a.predicateType === SLSA_PROVENANCE_V0_2)
  if (!slsaAttestation?.bundle?.dsseEnvelope) return null

  const payload = decodePayload(slsaAttestation.bundle.dsseEnvelope.payload)
  if (!payload?.predicate) return null

  const pred = payload.predicate as SlsaPredicate
  const builderId = pred.runDetails?.builder?.id ?? pred.builder?.id ?? ''
  const providerInfo = getProviderInfo(builderId)

  const workflow = pred.buildDefinition?.externalParameters?.workflow
  const repo = workflow?.repository?.replace(/\/$/, '').replace(/\.git$/, '') ?? ''
  const workflowPath = workflow?.path ?? ''
  const ref = workflow?.ref?.replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '') ?? 'main'

  const resolved = pred.buildDefinition?.resolvedDependencies?.[0]
  const commitSha = resolved?.digest?.gitCommit ?? ''

  const rawInvocationId =
    pred.runDetails?.metadata?.invocationId ?? pred.metadata?.buildInvocationId
  const buildSummaryUrl =
    rawInvocationId?.startsWith('http://') || rawInvocationId?.startsWith('https://')
      ? rawInvocationId
      : undefined
  const sourceCommitUrl = repo && commitSha ? repoUrlToCommitUrl(repo, commitSha) : undefined
  const buildFileUrl = repo && workflowPath ? repoUrlToBlobUrl(repo, workflowPath, ref) : undefined

  const tlogEntries = slsaAttestation.bundle.verificationMaterial?.tlogEntries
  const logIndex = tlogEntries?.[0]?.logIndex
  const publicLedgerUrl = logIndex ? `${SIGSTORE_SEARCH_BASE}/?logIndex=${logIndex}` : undefined

  return {
    provider: providerInfo.provider,
    providerLabel: providerInfo.providerLabel,
    buildSummaryUrl,
    sourceCommitUrl,
    sourceCommitSha: commitSha || undefined,
    buildFileUrl,
    buildFilePath: workflowPath || undefined,
    publicLedgerUrl,
  }
}
