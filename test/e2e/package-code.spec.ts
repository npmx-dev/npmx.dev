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
})
