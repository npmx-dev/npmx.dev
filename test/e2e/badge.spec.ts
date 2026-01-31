import { expect, test } from '@nuxt/test-utils/playwright'

function toLocalUrl(baseURL: string | undefined, path: string): string {
  if (!baseURL) return path
  return baseURL.endsWith('/') ? `${baseURL}${path.slice(1)}` : `${baseURL}${path}`
}

async function fetchBadge(page: { request: { get: (url: string) => Promise<any> } }, url: string) {
  const response = await page.request.get(url)
  const body = await response.text()
  return { response, body }
}

test.describe('badge API', () => {
  test('unscoped package badge renders SVG', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/badge/nuxt')
    const { response, body } = await fetchBadge(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/svg+xml')
    expect(body).toContain('<svg')
    expect(body).toContain('nuxt')
  })

  test('scoped package badge renders SVG', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/badge/@nuxt/kit')
    const { response, body } = await fetchBadge(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/svg+xml')
    expect(body).toContain('<svg')
    expect(body).toContain('@nuxt/kit')
  })

  test('explicit version badge includes requested version', async ({ page, baseURL }) => {
    const url = toLocalUrl(baseURL, '/api/registry/badge/nuxt/v/3.12.0')
    const { response, body } = await fetchBadge(page, url)

    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/svg+xml')
    expect(body).toContain('<svg')
    expect(body).toContain('nuxt')
    expect(body).toContain('3.12.0')
  })
})
