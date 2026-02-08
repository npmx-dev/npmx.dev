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
})
