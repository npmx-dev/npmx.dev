import { describe, expect, it, vi, beforeEach } from 'vitest'

/** The subset of the batch-purl request options the tests assert against */
interface SocketRequest {
  method: string
  timeout?: number
  headers: { authorization: string; accept: string }
  body: { components: Array<{ purl: string }> }
  responseType: string
}

const $fetchMock = vi.fn<(url: string, options: SocketRequest) => Promise<string>>()
vi.stubGlobal('$fetch', $fetchMock)

/** Retrieve a recorded $fetch call, failing loudly if it never happened
 * (instead of a non-null assertion that hides a missing call) */
function fetchCall(index: number): [string, SocketRequest] {
  const call = $fetchMock.mock.calls[index]
  if (!call) throw new Error(`expected a $fetch call at index ${index}, but none was recorded`)
  return call
}

let runtimeConfig: { socket: { apiKey: string; orgSlug: string }; public: Record<string, unknown> }
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

// in-memory stand-in for Nitro's `cache` storage, so the per-purl cache is
// exercised; cleared per test for isolation. The fail flags simulate a storage
// driver outage so the graceful-degradation paths can be asserted.
const cacheStore = new Map<string, unknown>()
let failCacheRead = false
let failCacheWrite = false
vi.stubGlobal('useStorage', () => ({
  getItem: async (key: string) => (cacheStore.has(key) ? cacheStore.get(key) : null),
  setItem: async (key: string, value: unknown) => {
    cacheStore.set(key, value)
  },
  getItems: async (keys: string[]) => {
    if (failCacheRead) throw new Error('cache storage unavailable')
    return keys.map(key => ({ key, value: cacheStore.has(key) ? cacheStore.get(key) : null }))
  },
  setItems: async (items: Array<{ key: string; value: unknown }>) => {
    if (failCacheWrite) throw new Error('cache storage unavailable')
    for (const { key, value } of items) cacheStore.set(key, value)
  },
}))

/** Fresh module per test: resets the quota circuit-breaker state */
async function importSocket() {
  vi.resetModules()
  return await import('#server/utils/socket')
}

function configureSocket() {
  runtimeConfig = {
    socket: { apiKey: 'test-key', orgSlug: 'test-org' },
    public: {},
  }
}

const PACKAGES = [{ name: 'vuln-pkg', version: '1.0.0' }]

describe('socket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheStore.clear()
    failCacheRead = false
    failCacheWrite = false
    runtimeConfig = { socket: { apiKey: '', orgSlug: '' }, public: {} }
  })

  describe('toNpmPurl', () => {
    it('builds purls for plain and scoped packages', async () => {
      const { toNpmPurl } = await importSocket()
      expect(toNpmPurl('lodash', '4.17.21')).toBe('pkg:npm/lodash@4.17.21')
      expect(toNpmPurl('@babel/core', '7.0.0')).toBe('pkg:npm/%40babel/core@7.0.0')
    })
  })

  describe('querySocketForTree', () => {
    it('reports unconfigured without an API key and makes no requests', async () => {
      const { querySocketForTree } = await importSocket()
      const scan = await querySocketForTree(PACKAGES)

      expect(scan.status).toBe('unconfigured')
      expect(scan.vulnerabilities.size).toBe(0)
      expect(scan.supplyChainAlerts.size).toBe(0)
      expect($fetchMock).not.toHaveBeenCalled()
    })

    it('reports unconfigured (no request) when only one of key/slug is set', async () => {
      runtimeConfig = { socket: { apiKey: 'key', orgSlug: '' }, public: {} }
      const { querySocketForTree } = await importSocket()
      const scan = await querySocketForTree(PACKAGES)

      expect(scan.status).toBe('unconfigured')
      expect($fetchMock).not.toHaveBeenCalled()
    })

    it('keeps valid artifacts when a later ndjson line is malformed', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      const artifact = {
        type: 'npm',
        name: 'vuln-pkg',
        version: '1.0.0',
        alerts: [{ key: 'a', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
      }
      // a truncated/garbled trailing line must not discard the whole chunk
      $fetchMock.mockResolvedValue(`${JSON.stringify(artifact)}\n{ "type": "npm", "name":`)

      const scan = await querySocketForTree(PACKAGES)

      expect(scan.status).toBe('ok')
      expect(scan.vulnerabilities.has('vuln-pkg@1.0.0')).toBe(true)
    })

    it('normalizes vulnerability and supply-chain alerts from an ndjson response', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      const artifact = {
        type: 'npm',
        name: 'vuln-pkg',
        version: '1.0.0',
        alerts: [
          {
            key: 'alert-1',
            type: 'cve',
            severity: 'high',
            category: 'vulnerability',
            props: {
              ghsaId: 'GHSA-aaaa-bbbb-cccc',
              cveId: 'CVE-2024-12345',
              title: 'Bad vulnerability',
              firstPatchedVersionIdentifier: '1.2.3',
              reachability: 'unreachable',
            },
          },
          {
            key: 'alert-2',
            type: 'mediumCVE',
            // the Socket API schema has used 'middle' for medium severity
            severity: 'middle',
            category: 'vulnerability',
            props: {},
          },
          {
            key: 'alert-3',
            type: 'malware',
            severity: 'critical',
            category: 'supplyChainRisk',
            props: {},
          },
          // not in the curated allowlists - ignored
          { key: 'alert-4', type: 'usesEval', severity: 'low', props: {} },
          // synthetic alert - ignored
          { key: 'alert-5', type: 'pendingScan', severity: 'low', props: {} },
        ],
      }
      $fetchMock.mockResolvedValue(`${JSON.stringify(artifact)}\n`)

      const scan = await querySocketForTree(PACKAGES)

      expect(scan.status).toBe('ok')
      expect($fetchMock).toHaveBeenCalledTimes(1)
      const [url, options] = fetchCall(0)
      expect(url).toBe('https://api.socket.dev/v0/orgs/test-org/purl?alerts=true')
      expect(options.headers.authorization).toBe('Bearer test-key')
      expect(options.body.components).toEqual([{ purl: 'pkg:npm/vuln-pkg@1.0.0' }])

      const findings = scan.vulnerabilities.get('vuln-pkg@1.0.0')!
      expect(findings).toHaveLength(2)
      expect(findings[0]).toMatchObject({
        id: 'GHSA-aaaa-bbbb-cccc',
        ghsaId: 'GHSA-aaaa-bbbb-cccc',
        cveId: 'CVE-2024-12345',
        summary: 'Bad vulnerability',
        severity: 'high',
        fixedIn: '1.2.3',
        reachability: 'unreachable',
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
      })
      // no GHSA/CVE id: synthetic id, socket.dev url, 'middle' -> moderate
      expect(findings[1]).toMatchObject({
        id: 'SOCKET-alert-2',
        severity: 'moderate',
        url: 'https://socket.dev/npm/package/vuln-pkg',
      })

      const alerts = scan.supplyChainAlerts.get('vuln-pkg@1.0.0')!
      expect(alerts).toEqual([
        {
          type: 'malware',
          severity: 'critical',
          url: 'https://socket.dev/npm/package/vuln-pkg',
          sources: ['socket'],
        },
      ])
    })

    it('parses a JSON array response and scoped artifact names', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockResolvedValue(
        JSON.stringify([
          {
            type: 'npm',
            name: 'core',
            namespace: '@babel',
            version: '7.0.0',
            alerts: [
              {
                key: 'a',
                type: 'cve',
                severity: 'critical',
                props: { ghsaId: 'GHSA-1111-2222-3333' },
              },
            ],
          },
        ]),
      )

      const scan = await querySocketForTree([{ name: '@babel/core', version: '7.0.0' }])
      expect(scan.vulnerabilities.has('@babel/core@7.0.0')).toBe(true)
    })

    it('extracts reachability from artifact alertKeysToReachabilityTypes', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockResolvedValue(
        JSON.stringify([
          {
            type: 'npm',
            name: 'vuln-pkg',
            version: '1.0.0',
            alerts: [{ key: 'k1', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
            alertKeysToReachabilityTypes: { k1: ['unreachable', 'maybe_reachable'] },
          },
        ]),
      )

      const scan = await querySocketForTree(PACKAGES)
      // strongest verdict wins: maybe_reachable > unreachable
      expect(scan.vulnerabilities.get('vuln-pkg@1.0.0')![0]!.reachability).toBe('maybe_reachable')
    })

    it('deduplicates repeated supply-chain alert types for the same package', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockResolvedValue(
        JSON.stringify([
          {
            type: 'npm',
            name: 'vuln-pkg',
            version: '1.0.0',
            alerts: [
              { key: 'a', type: 'installScripts', severity: 'low', props: { file: 'a.js' } },
              { key: 'b', type: 'installScripts', severity: 'low', props: { file: 'b.js' } },
            ],
          },
        ]),
      )

      const scan = await querySocketForTree(PACKAGES)
      expect(scan.supplyChainAlerts.get('vuln-pkg@1.0.0')).toHaveLength(1)
    })

    it('chunks requests above the batch limit', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockResolvedValue('[]')
      const manyPackages = Array.from({ length: 1500 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
      }))

      const scan = await querySocketForTree(manyPackages)
      expect(scan.status).toBe('ok')
      expect($fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchCall(0)[1].body.components).toHaveLength(1024)
      expect(fetchCall(1)[1].body.components).toHaveLength(476)
    })

    it('reports failed on request errors', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockRejectedValue(new Error('network error'))

      const scan = await querySocketForTree(PACKAGES)
      expect(scan.status).toBe('failed')
    })

    it('reports partial when some chunks succeed and others fail', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      configureSocket()
      const { querySocketForTree } = await importSocket()

      // first chunk (1024) returns a finding, second chunk (network) fails
      const artifact = {
        type: 'npm',
        name: 'pkg-0',
        version: '1.0.0',
        alerts: [{ key: 'a', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
      }
      let call = 0
      $fetchMock.mockImplementation(async () => {
        call++
        if (call === 1) return `${JSON.stringify(artifact)}\n`
        throw new Error('network error')
      })
      const manyPackages = Array.from({ length: 1500 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
      }))

      const scan = await querySocketForTree(manyPackages)
      expect(scan.status).toBe('partial')
      expect(scan.vulnerabilities.has('pkg-0@1.0.0')).toBe(true)
    })

    it('trips the circuit breaker on quota errors', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      configureSocket()
      const { querySocketForTree } = await importSocket()

      $fetchMock.mockRejectedValue(Object.assign(new Error('quota exceeded'), { statusCode: 429 }))

      const first = await querySocketForTree(PACKAGES)
      expect(first.status).toBe('unavailable')
      expect($fetchMock).toHaveBeenCalledTimes(1)

      // While the breaker is open, no further requests are attempted
      const second = await querySocketForTree(PACKAGES)
      expect(second.status).toBe('unavailable')
      expect($fetchMock).toHaveBeenCalledTimes(1)
    })

    it('reports ok for an empty package list without requests', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      const scan = await querySocketForTree([])
      expect(scan.status).toBe('ok')
      expect($fetchMock).not.toHaveBeenCalled()
    })

    it('caches findings per purl so a repeat scan makes no request', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()

      const artifact = {
        type: 'npm',
        name: 'vuln-pkg',
        version: '1.0.0',
        alerts: [{ key: 'a', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
      }
      $fetchMock.mockResolvedValue(`${JSON.stringify(artifact)}\n`)

      const first = await querySocketForTree(PACKAGES)
      expect(first.vulnerabilities.has('vuln-pkg@1.0.0')).toBe(true)
      expect($fetchMock).toHaveBeenCalledTimes(1)

      const second = await querySocketForTree(PACKAGES)
      expect(second.status).toBe('ok')
      expect(second.vulnerabilities.has('vuln-pkg@1.0.0')).toBe(true)
      // served entirely from the per-purl cache
      expect($fetchMock).toHaveBeenCalledTimes(1)
    })

    it('requests only the purls an overlapping tree has not cached yet', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()
      $fetchMock.mockResolvedValue('[]')

      await querySocketForTree([
        { name: 'a', version: '1.0.0' },
        { name: 'b', version: '1.0.0' },
      ])
      expect($fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchCall(0)[1].body.components).toHaveLength(2)

      await querySocketForTree([
        { name: 'b', version: '1.0.0' },
        { name: 'c', version: '1.0.0' },
      ])
      expect($fetchMock).toHaveBeenCalledTimes(2)
      // only the uncached `c` is re-requested; `b` is reused
      expect(fetchCall(1)[1].body.components).toEqual([{ purl: 'pkg:npm/c@1.0.0' }])
    })

    it('caches alert-free packages so they are not re-queried', async () => {
      configureSocket()
      const { querySocketForTree } = await importSocket()
      $fetchMock.mockResolvedValue('[]')

      await querySocketForTree(PACKAGES)
      await querySocketForTree(PACKAGES)
      expect($fetchMock).toHaveBeenCalledTimes(1)
    })

    it('degrades to a direct Socket query when the cache read fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      configureSocket()
      failCacheRead = true
      const { querySocketForTree } = await importSocket()

      const artifact = {
        type: 'npm',
        name: 'vuln-pkg',
        version: '1.0.0',
        alerts: [{ key: 'a', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
      }
      $fetchMock.mockResolvedValue(`${JSON.stringify(artifact)}\n`)

      // a cache-storage outage must not fail the scan: every purl becomes a miss
      const scan = await querySocketForTree(PACKAGES)
      expect(scan.status).toBe('ok')
      expect(scan.vulnerabilities.has('vuln-pkg@1.0.0')).toBe(true)
      expect($fetchMock).toHaveBeenCalledTimes(1)
    })

    it('keeps fetched findings when the cache write fails', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      configureSocket()
      failCacheWrite = true
      const { querySocketForTree } = await importSocket()

      const artifact = {
        type: 'npm',
        name: 'vuln-pkg',
        version: '1.0.0',
        alerts: [{ key: 'a', type: 'cve', severity: 'high', props: { ghsaId: 'GHSA-x' } }],
      }
      $fetchMock.mockResolvedValue(`${JSON.stringify(artifact)}\n`)

      const scan = await querySocketForTree(PACKAGES)
      expect(scan.status).toBe('ok')
      expect(scan.vulnerabilities.has('vuln-pkg@1.0.0')).toBe(true)
    })
  })
})
