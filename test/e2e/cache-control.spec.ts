import { expect, test } from './test-utils'

test.describe('cache control', () => {
  for (const path of [
    '/org/nuxt',
    '/package-stats/nuxt/v/4.3.1',
    '/package-timeline/nuxt/v/4.3.1',
    '/compare?packages=nuxt,vue',
  ]) {
    test(`caches ${path} at the CDN`, async ({ page }) => {
      const response = await page.request.get(path)

      expect(response.status()).toBe(200)
      expect(response.headers()['cache-control']).toMatch(/\bs-maxage=\d+/)
    })
  }

  test('does not cache error responses at the CDN', async ({ page }) => {
    const response = await page.request.get('/org/this-org-does-not-exist')

    expect(response.status()).toBe(404)
    expect(response.headers()['cache-control']).not.toMatch(/\bs-maxage=/)
  })
})
