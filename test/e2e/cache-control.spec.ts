import { expect, test } from './test-utils'

test.describe('cache control', () => {
  for (const path of [
    '/org/nuxt',
    '/package-stats/nuxt/v/4.3.1',
    '/package-timeline/nuxt/v/4.3.1',
    '/compare?packages=nuxt,vue',
    '/package/nuxt/v/4.3.1',
    '/package/@nuxt/kit/v/4.3.0',
  ]) {
    test(`caches ${path} at the CDN`, async ({ page }) => {
      const response = await page.request.get(path)

      expect(response.status()).toBe(200)
      expect(response.headers()['cache-control']).toMatch(/\bs-maxage=\d+/)
    })
  }

  for (const path of [
    '/org/this-org-does-not-exist',
    '/package/this-package-does-not-exist/v/1.0.0',
    '/package/nuxt/v/4.3.1/_payload.json',
    '/package/@nuxt/kit/v/4.3.0/_payload.json',
  ]) {
    test(`does not cache the ${path} error at the CDN`, async ({ page }) => {
      const response = await page.request.get(path)

      expect(response.status()).toBe(404)
      expect(response.headers()['cache-control']).not.toMatch(/\bs-maxage=/)
    })
  }
})
