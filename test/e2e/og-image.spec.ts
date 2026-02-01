import { expect, test } from '@nuxt/test-utils/playwright'

const paths = ['/', '/package/nuxt/v/3.20.2']
for (const path of paths) {
  test.describe(path, () => {
    test.skip(`og image for ${path}`, async ({ page, goto, baseURL }) => {
      await goto(path, { waitUntil: 'domcontentloaded' })

      const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute('content')
      expect(ogImageUrl).toBeTruthy()

      const ogImagePath = new URL(ogImageUrl!).pathname
      const localUrl = baseURL?.endsWith('/')
        ? `${baseURL}${ogImagePath.slice(1)}`
        : `${baseURL}${ogImagePath}`
      const response = await page.request.get(localUrl)

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('image/png')

      const imageBuffer = await response.body()
      expect(imageBuffer).toMatchSnapshot({ name: `og-image-for-${path.replace(/\//g, '-')}.png` })
    })
  })
}
