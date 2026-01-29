import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Create Command', () => {
  test.describe('Visibility', () => {
    test('/vite - should show create command (same maintainers)', async ({ page, goto }) => {
      await goto('/vite', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('.group\\/createcmd')
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create vite/i)

      // Link to create-vite should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/create-vite"]')).toBeAttached()
    })

    test('/next - should show create command (shared maintainer, same repo)', async ({
      page,
      goto,
    }) => {
      await goto('/next', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('.group\\/createcmd')
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create next-app/i)

      // Link to create-next-app should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/create-next-app"]')).toBeAttached()
    })

    test('/nuxt - should show create command (same maintainer, same org)', async ({
      page,
      goto,
    }) => {
      await goto('/nuxt', { waitUntil: 'domcontentloaded' })

      // Create command section should be visible (SSR)
      // nuxt has create-nuxt package, so command is "npm create nuxt"
      // Use specific container to avoid matching README code blocks
      const createCommandSection = page.locator('.group\\/createcmd')
      await expect(createCommandSection).toBeVisible()
      await expect(createCommandSection.locator('code')).toContainText(/create nuxt/i)
    })

    test('/color - should NOT show create command (different maintainers)', async ({
      page,
      goto,
    }) => {
      await goto('/color', { waitUntil: 'domcontentloaded' })

      // Wait for package to load
      await expect(page.locator('h1').filter({ hasText: 'color' })).toBeVisible()

      // Create command section should NOT be visible (different maintainers)
      const createCommandSection = page.locator('.group\\/createcmd')
      await expect(createCommandSection).not.toBeVisible()
    })

    test('/lodash - should NOT show create command (no create-lodash exists)', async ({
      page,
      goto,
    }) => {
      await goto('/lodash', { waitUntil: 'domcontentloaded' })

      // Wait for package to load
      await expect(page.locator('h1').filter({ hasText: 'lodash' })).toBeVisible()

      // Create command section should NOT be visible (no create-lodash exists)
      const createCommandSection = page.locator('.group\\/createcmd')
      await expect(createCommandSection).not.toBeVisible()
    })
  })

  test.describe('Copy Functionality', () => {
    test('hovering create command shows copy button', async ({ page, goto }) => {
      await goto('/vite', { waitUntil: 'hydration' })

      // Wait for package analysis API to load (create command requires this)
      // First ensure the package page has loaded
      await expect(page.locator('h1')).toContainText('vite')

      // Find the create command container (wait longer for API response)
      const createCommandContainer = page.locator('.group\\/createcmd')
      await expect(createCommandContainer).toBeVisible({ timeout: 15000 })

      // Copy button should initially be hidden (opacity-0)
      const copyButton = createCommandContainer.locator('button')
      await expect(copyButton).toHaveCSS('opacity', '0')

      // Hover over the container
      await createCommandContainer.hover()

      // Copy button should become visible
      await expect(copyButton).toHaveCSS('opacity', '1')
    })

    test('clicking copy button copies create command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/vite', { waitUntil: 'hydration' })

      // Find and hover over the create command container
      const createCommandContainer = page.locator('.group\\/createcmd')
      await createCommandContainer.hover()

      // Click the copy button
      const copyButton = createCommandContainer.locator('button')
      await copyButton.click()

      // Button text should change to "copied!"
      await expect(copyButton).toContainText(/copied/i)

      // Verify clipboard content contains the create command
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/create vite/i)

      await expect(copyButton).toContainText(/copy/i, { timeout: 5000 })
      await expect(copyButton).not.toContainText(/copied/i)
    })
  })

  test.describe('Install Command Copy', () => {
    test('hovering install command shows copy button', async ({ page, goto }) => {
      await goto('/lodash', { waitUntil: 'hydration' })

      // Find the install command container
      const installCommandContainer = page.locator('.group\\/installcmd')
      await expect(installCommandContainer).toBeVisible()

      // Copy button should initially be hidden
      const copyButton = installCommandContainer.locator('button')
      await expect(copyButton).toHaveCSS('opacity', '0')

      // Hover over the container
      await installCommandContainer.hover()

      // Copy button should become visible
      await expect(copyButton).toHaveCSS('opacity', '1')
    })

    test('clicking copy button copies install command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/lodash', { waitUntil: 'hydration' })

      // Find and hover over the install command container
      const installCommandContainer = page.locator('.group\\/installcmd')
      await installCommandContainer.hover()

      // Click the copy button
      const copyButton = installCommandContainer.locator('button')
      await copyButton.click()

      // Button text should change to "copied!"
      await expect(copyButton).toContainText(/copied/i)

      // Verify clipboard content contains the install command
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/install lodash|add lodash/i)

      await expect(copyButton).toContainText(/copy/i, { timeout: 5000 })
      await expect(copyButton).not.toContainText(/copied/i)
    })
  })
})
