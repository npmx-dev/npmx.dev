import { expect, test } from './test-utils'

test.describe('Create Command', () => {
  test.describe('Visibility', () => {
    test('/vite - should show create command (same maintainers)', async ({ page, goto }) => {
      await goto('/package/vite', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('[data-testid="create-cmd"]').first()
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create vite/i)

      // Link to create-vite should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/package/create-vite"]').first()).toBeAttached()
    })

    test('/next - should show create command (shared maintainer, same repo)', async ({
      page,
      goto,
    }) => {
      await goto('/package/next', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('[data-testid="create-cmd"]').first()
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create next-app/i)

      // Link to create-next-app should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/package/create-next-app"]').first()).toBeAttached()
    })

    test('/nuxt - should show create command (same maintainer, same org)', async ({
      page,
      goto,
    }) => {
      await goto('/package/nuxt', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // nuxt has create-nuxt package, so command is "npm create nuxt"
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('[data-testid="create-cmd"]').first()
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create nuxt/i)
    })

    test('/is-odd - should NOT show create command (no create-is-odd exists)', async ({
      page,
      goto,
    }) => {
      await goto('/package/is-odd', { waitUntil: 'domcontentloaded' })

      // Wait for package to load
      await expect(page.locator('h1').filter({ hasText: 'is-odd' })).toBeVisible()

      // Create command section should NOT be visible (no create-is-odd exists)
      // Use .first() for consistency, though none should exist
      const createCommandSection = page.locator('[data-testid="create-cmd"]').first()
      await expect(createCommandSection).not.toBeVisible()
    })
  })

  test.describe('Install Command Copy', () => {
    test('copy button is always visible on install command', async ({ page, goto }) => {
      await goto('/package/is-odd', { waitUntil: 'hydration' })

      // Find the install command container
      const installCommandContainer = page.locator('[data-testid="install-cmd"]').first()
      await expect(installCommandContainer).toBeVisible()

      // Copy button should always be visible (no hover required)
      const copyButton = installCommandContainer.locator('button')
      await expect(copyButton).toBeVisible()
      await expect(copyButton).toHaveCSS('opacity', '1')
    })

    test('clicking copy button copies install command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/package/is-odd', { waitUntil: 'hydration' })

      // Find the install command container and click copy directly (no hover needed)
      const installCommandContainer = page.locator('[data-testid="install-cmd"]').first()
      const copyButton = installCommandContainer.locator('button')
      await copyButton.click()

      // Button text should change to "copied!"
      await expect(copyButton).toContainText(/copied/i)

      // Verify clipboard content contains the install command
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/install is-odd|add is-odd/i)

      await expect(copyButton).toContainText(/copy/i, { timeout: 5000 })
      await expect(copyButton).not.toContainText(/copied/i)
    })
  })
})
