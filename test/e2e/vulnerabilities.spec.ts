import { expect, test } from './test-utils'

function toLocalUrl(baseURL: string | undefined, path: string): string {
  if (!baseURL) return path
  return baseURL.endsWith('/') ? `${baseURL}${path.slice(1)}` : `${baseURL}${path}`
}

async function fetchVulnerabilities(
  page: { request: { get: (url: string) => Promise<any> } },
  url: string,
) {
  const response = await page.request.get(url)
  const body = await response.json()
  return { response, body }
}

test.describe('vulnerabilities API', () => {
  test('unscoped package vulnerabilities analysis', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/vue')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', 'vue')
    expect(body).toHaveProperty('version')
    expect(body).toHaveProperty('totalCounts')
    expect(body).toHaveProperty('sourceStatus.osv')
  })

  test('scoped package vulnerabilities with URL encoding', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@nuxt%2Fkit')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@nuxt/kit')
    expect(body).toHaveProperty('version')
  })

  test('scoped package with explicit version and URL encoding', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@nuxt%2Fkit/v/3.20.0')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@nuxt/kit')
    expect(body).toHaveProperty('version', '3.20.0')
  })

  test('scoped package without URL encoding (for comparison)', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@nuxt/kit')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@nuxt/kit')
    expect(body).toHaveProperty('version')
  })

  test('scoped package with different scope', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@types%2Fnode')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@types/node')
    expect(body).toHaveProperty('version')
  })

  test('package not found returns appropriate error', async ({ page, baseURL }) => {
    const url = toLocalUrl(
      baseURL,
      '/api/registry/vulnerabilities/this-package-definitely-does-not-exist-12345',
    )
    const response = await page.request.get(url)

    expect(response.status()).toBe(404) // Package not found returns 404
  })

  // The fixture layer (modules/runtime/server/cache.ts) fabricates findings
  // for is-odd from both OSV and Socket, exercising the merged two-source path
  test('merges OSV and Socket findings for the security fixture package', async ({
    page,
    baseURL,
  }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/is-odd')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(body.sourceStatus).toEqual({ osv: 'ok', socket: 'ok' })

    const fixturePkg = body.vulnerablePackages.find(
      (pkg: { name: string }) => pkg.name === 'is-odd',
    )
    expect(fixturePkg).toBeDefined()

    // Reported by both sources: merged into one entry, tagged with both
    const shared = fixturePkg.vulnerabilities.find(
      (vuln: { id: string }) => vuln.id === 'GHSA-npmx-test-0001',
    )
    expect(shared).toBeDefined()
    expect(shared.sources).toEqual(expect.arrayContaining(['osv', 'socket']))
    expect(shared.sources).toHaveLength(2)
    expect(shared.reachability).toBe('reachable')
    expect(shared.cveId).toBe('CVE-2024-00001')

    // Reported only by Socket
    const socketOnly = fixturePkg.vulnerabilities.find(
      (vuln: { id: string }) => vuln.id === 'GHSA-npmx-test-0002',
    )
    expect(socketOnly).toBeDefined()
    expect(socketOnly.sources).toEqual(['socket'])
    expect(socketOnly.reachability).toBe('unreachable')

    // Counts include both sources, deduplicated
    expect(fixturePkg.counts.total).toBe(2)

    // Supply-chain alerts from Socket's curated allowlist
    const supplyChainPkg = body.supplyChainPackages.find(
      (pkg: { name: string }) => pkg.name === 'is-odd',
    )
    expect(supplyChainPkg).toBeDefined()
    expect(supplyChainPkg.alerts).toEqual([
      expect.objectContaining({ type: 'troll', sources: ['socket'] }),
    ])
  })
})
