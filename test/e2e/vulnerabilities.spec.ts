import { expect, test } from '@nuxt/test-utils/playwright'

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
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@vitejs%2Fplugin-vue')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@vitejs/plugin-vue')
    expect(body).toHaveProperty('version')
  })

  test('scoped package with explicit version and URL encoding', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@vitejs%2Fplugin-vue/v/6.0.3')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@vitejs/plugin-vue')
    expect(body).toHaveProperty('version', '6.0.3')
  })

  test('scoped package without URL encoding (for comparison)', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@nuxt/kit')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@nuxt/kit')
    expect(body).toHaveProperty('version')
  })

  test('complex scoped package name with URL encoding', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/vulnerabilities/@babel%2Fcore')
    const { response, body } = await fetchVulnerabilities(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(body).toHaveProperty('package', '@babel/core')
    expect(body).toHaveProperty('version')
  })

  test('package not found returns appropriate error', async ({ page, baseURL }) => {
    const url = toLocalUrl(
      baseURL,
      '/api/registry/vulnerabilities/this-package-definitely-does-not-exist-12345',
    )
    const response = await page.request.get(url)

    expect(response.status()).toBe(502) // Based on handleApiError fallback
  })
})
