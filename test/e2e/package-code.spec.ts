import { expect, test } from './test-utils'

test.describe('Package Code Viewer', () => {
  test('/package-code/empathic/v/2.0.0 loads correctly', async ({ page, goto }) => {
    await goto('/package-code/empathic/v/2.0.0', { waitUntil: 'domcontentloaded' })

    // Verify page heading or package name container
    await expect(page.locator('h1')).toContainText('empathic')

    // Verify the specific version is rendered
    await expect(
      page.locator('[data-testid="version-selector-button"]').locator('text=2.0.0'),
    ).toBeVisible()

    const codePage = page.locator('#code-page-container')

    await expect(
      codePage.locator('aside').getByRole('link', { name: 'package.json', exact: true }),
    ).toBeVisible()

    const directoryListing = codePage.getByRole('table')
    await expect(directoryListing).toBeVisible()

    await expect(
      directoryListing.locator('a[href="/package-code/empathic/v/2.0.0/package.json"]'),
    ).toBeVisible()
  })

  for (const path of [
    '/package-code/empathic/v/2.0.0/package.json',
    '/package/code/empathic/v/2.0.0/package.json',
  ]) {
    test(`${path} is a client-only shell that is not indexed`, async ({ page }) => {
      const response = await page.request.get(path)

      expect(response.headers()['x-robots-tag']).toBe('noindex')
      expect(await response.text()).toContain('data-ssr="false"')
    })

    test(`${path} renders meta tags for link preview bots`, async ({ page }) => {
      const response = await page.request.get(path, {
        headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' },
      })
      const html = await response.text()

      expect(response.headers()['x-robots-tag']).toBe('noindex')
      expect(html).toContain('<title>package.json - empathic@2.0.0 - npmx</title>')
      expect(html).toMatch(/<meta property="og:image" content="[^"]+\/_og\//)
      expect(html).not.toContain('__NUXT_DATA__')
      expect(html).not.toContain('code-page-container')
      expect(html).not.toContain('<footer')
    })
  }
})
