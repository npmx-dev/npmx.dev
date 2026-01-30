import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Create Command', () => {
  test.describe('Visibility', () => {
    test('/vite - should show create command (same maintainers)', async ({ page, goto }) => {
      await goto('/vite', { waitUntil: 'hydration' })

      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      // Create command is loaded via API (packageAnalysis), wait for it
      // All PM variants are rendered; npm is visible by default
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /create vite/i })
      await expect(createCommandRow).toBeVisible()
      await expect(createCommandRow.locator('code')).toContainText(/create vite/i)

      // Link to create-vite should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/create-vite"]')).toBeAttached()
    })

    test('/next - should show create command (shared maintainer, same repo)', async ({
      page,
      goto,
    }) => {
      await goto('/next', { waitUntil: 'hydration' })

      // Wait for package page to load
      await expect(page.locator('h1')).toContainText('next', { timeout: 15000 })

      // Create command is loaded via API
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /create next-app/i })
      await expect(createCommandRow).toBeVisible({ timeout: 15000 })
      await expect(createCommandRow.locator('code')).toContainText(/create next-app/i)

      // Link to create-next-app should be present
      await expect(page.locator('a[href="/create-next-app"]')).toBeAttached()
    })

    test('/nuxt - should show create command (same maintainer, same org)', async ({
      page,
      goto,
    }) => {
      await goto('/nuxt', { waitUntil: 'hydration' })

      // Wait for package page to load (longer timeout for network flakiness)
      await expect(page.locator('h1')).toContainText('nuxt', { timeout: 15000 })

      // Create command is loaded via API, wait for it
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /create nuxt/i })
      await expect(createCommandRow).toBeVisible({ timeout: 15000 })
      await expect(createCommandRow.locator('code')).toContainText(/create nuxt/i)
    })

    test('/color - should NOT show create command (different maintainers)', async ({
      page,
      goto,
    }) => {
      await goto('/color', { waitUntil: 'hydration' })

      // Wait for package page to load
      await expect(page.locator('h1').filter({ hasText: 'color' })).toBeVisible()

      // Wait for API to complete (install command should be visible)
      await expect(page.locator('[data-pm-cmd="npm"]').first()).toBeVisible()

      // Give time for any create command to appear, then verify it doesn't
      await page.waitForTimeout(1000)

      // Create command should NOT exist (different maintainers)
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /\bcreate color\b/i })
      await expect(createCommandRow).toHaveCount(0)
    })

    test('/lodash - should NOT show create command (no create-lodash exists)', async ({
      page,
      goto,
    }) => {
      await goto('/lodash', { waitUntil: 'hydration' })

      // Wait for package page to load
      await expect(page.locator('h1').filter({ hasText: 'lodash' })).toBeVisible()

      // Wait for API to complete (install command should be visible)
      await expect(page.locator('[data-pm-cmd="npm"]').first()).toBeVisible()

      // Give time for any create command to appear, then verify it doesn't
      await page.waitForTimeout(1000)

      // Create command should NOT exist (no create-lodash exists)
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /\bcreate lodash\b/i })
      await expect(createCommandRow).toHaveCount(0)
    })
  })

  test.describe('Copy Functionality', () => {
    test('hovering create command shows copy button', async ({ page, goto }) => {
      await goto('/vite', { waitUntil: 'hydration' })

      // Wait for package analysis API to load (create command requires this)
      // First ensure the package page has loaded (longer timeout for network flakiness)
      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      // Find the create command row (npm variant) - it contains "create vite" in code
      // The component renders all PM variants; npm is visible by default
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /create vite/i })
      await expect(createCommandRow).toBeVisible({ timeout: 15000 })

      // Copy button should initially be hidden (opacity-0)
      const copyButton = createCommandRow.locator('button')
      await expect(copyButton).toHaveCSS('opacity', '0')

      // Hover over the container
      await createCommandRow.hover()

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

      // Wait for h1 to confirm page loaded (longer timeout for network flakiness)
      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      // Find and hover over the create command row (npm variant), wait for API
      const createCommandRow = page
        .locator('[data-pm-cmd="npm"]')
        .filter({ hasText: /create vite/i })
      await expect(createCommandRow).toBeVisible({ timeout: 15000 })
      await createCommandRow.hover()

      // Click the copy button
      const copyButton = createCommandRow.locator('button')
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

      // Find the npm install command row (npm is the default, so it's visible)
      // The component uses group/cmd class for each command row
      const installCommandRow = page.locator('[data-pm-cmd="npm"]').first()
      await expect(installCommandRow).toBeVisible()

      // Copy button should initially be hidden (opacity-0)
      const copyButton = installCommandRow.locator('button')
      await expect(copyButton).toHaveCSS('opacity', '0')

      // Hover over the container
      await installCommandRow.hover()

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

      // Find and hover over the npm install command row (npm is the default)
      const installCommandRow = page.locator('[data-pm-cmd="npm"]').first()
      await installCommandRow.hover()

      // Click the copy button
      const copyButton = installCommandRow.locator('button')
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
