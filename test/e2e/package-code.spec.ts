import { expect, test } from './test-utils'

test.describe('Package Code Viewer', () => {
  test('/package-code/empathic/v/2.0.0 loads correctly', async ({ page, goto }) => {
    await goto('/package-code/empathic/v/2.0.0', { waitUntil: 'domcontentloaded' })

    // Verify page heading or package name container
    await expect(page.locator('h1')).toContainText('empathic')

    // Verify the specific version is rendered
    await expect(page.locator('text=2.0.0').first()).toBeVisible()
  })
})
