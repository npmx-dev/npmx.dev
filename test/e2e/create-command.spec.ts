import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

/**
 * Dev/types/run/create commands live in the "additional commands" panel, which is
 * collapsed by default and only rendered once expanded (see Package/Install/Dropdown.vue).
 */
async function expandAdditionalCommands(page: Page) {
  const toggle = page.locator('[data-testid="install-commands-toggle"]').first()
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

test.describe('Create Command', () => {
  test.describe('Visibility', () => {
    test('/vite - should show create command (same maintainers)', async ({ page, goto }) => {
      await goto('/package/vite', { waitUntil: 'hydration' })
      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const createCommandSection = page.locator('[data-testid="create-command"]').first()
      await expect(createCommandSection).toBeVisible()
      const activePm = await page.locator('[data-pm]').first().getAttribute('data-pm')
      const commandRow = createCommandSection.locator(`[data-pm-additional-cmd="${activePm}"]`)
      await expect(commandRow).toBeVisible()
      await expect(commandRow).toContainText(/create vite/i)

      // Link to create-vite should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/package/create-vite"]').first()).toBeAttached()
    })

    test('/next - should show create command (shared maintainer, same repo)', async ({
      page,
      goto,
    }) => {
      await goto('/package/next', { waitUntil: 'hydration' })
      await expect(page.locator('h1')).toContainText('next', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const createCommandSection = page.locator('[data-testid="create-command"]').first()
      await expect(createCommandSection).toBeVisible()
      const activePm = await page.locator('[data-pm]').first().getAttribute('data-pm')
      const commandRow = createCommandSection.locator(`[data-pm-additional-cmd="${activePm}"]`)
      await expect(commandRow).toBeVisible()
      await expect(commandRow).toContainText(/create next-app/i)

      // Link to create-next-app should be present (uses sr-only text, so check attachment not visibility)
      await expect(page.locator('a[href="/package/create-next-app"]').first()).toBeAttached()
    })

    test('/nuxt - should show create command (same maintainer, same org)', async ({
      page,
      goto,
    }) => {
      await goto('/package/nuxt', { waitUntil: 'hydration' })
      await expect(page.locator('h1')).toContainText('nuxt', { timeout: 15000 })

      await expandAdditionalCommands(page)

      // nuxt has create-nuxt package, so command is "npm create nuxt"
      const createCommandSection = page.locator('[data-testid="create-command"]').first()
      await expect(createCommandSection).toBeVisible()
      const activePm = await page.locator('[data-pm]').first().getAttribute('data-pm')
      const commandRow = createCommandSection.locator(`[data-pm-additional-cmd="${activePm}"]`)
      await expect(commandRow).toBeVisible()
      await expect(commandRow).toContainText(/create nuxt/i)
    })

    test('/is-odd - should NOT show create command (no create-is-odd exists)', async ({
      page,
      goto,
    }) => {
      await goto('/package/is-odd', { waitUntil: 'hydration' })

      // Wait for package to load
      await expect(page.locator('h1').filter({ hasText: 'is-odd' })).toBeVisible()

      // is-odd has a @types package, so the panel still exists and expands,
      // but it must not contain a create command (no create-is-odd package)
      await expandAdditionalCommands(page)
      await expect(page.locator('[data-testid="create-command"]').first()).not.toBeVisible()
    })
  })

  test.describe('Copy Functionality', () => {
    test('copy button is accessible and keyboard discoverable', async ({ page, goto }) => {
      await goto('/package/vite', { waitUntil: 'hydration' })

      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const createCommandContainer = page.locator('[data-testid="create-command"]').first()
      await expect(createCommandContainer).toBeVisible({ timeout: 20000 })

      // Copy button should be in the DOM and accessible to screen readers
      const copyButton = createCommandContainer.locator('button')
      await expect(copyButton).toBeAttached()

      // Focus the button to verify it's keyboard accessible
      await copyButton.focus()
      await expect(copyButton).toBeFocused()
    })

    test('clicking copy button copies create command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/package/vite', { waitUntil: 'hydration' })
      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const createCommandContainer = page.locator('[data-testid="create-command"]').first()
      await expect(createCommandContainer).toBeVisible({ timeout: 20000 })

      const copyButton = createCommandContainer.locator('button')

      await copyButton.focus()
      await expect(copyButton).toBeFocused()

      await copyButton.click()

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:check/)

      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/create vite/i)

      await expect(page.locator('.nuxt-announcer [aria-live="polite"]')).toContainText(
        'Create command copied',
      )

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:copy/, {
        timeout: 5000,
      })
      await expect(copyButton.locator('span[aria-hidden="true"]')).not.toHaveClass(/i-lucide:check/)
    })
  })

  test.describe('Install Command Copy', () => {
    test('copy button is accessible and keyboard discoverable', async ({ page, goto }) => {
      await goto('/package/is-odd', { waitUntil: 'hydration' })

      // Find the install command container (always visible, no expand needed)
      const installCommandContainer = page.locator('[data-testid="install-command"]').first()
      await expect(installCommandContainer).toBeVisible()

      // Copy button should be in the DOM and accessible to screen readers
      const copyButton = installCommandContainer.locator('button')
      await expect(copyButton).toBeAttached()

      // Focus the button to verify it's keyboard accessible
      await copyButton.focus()
      await expect(copyButton).toBeFocused()
    })

    test('clicking copy button copies install command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/package/is-odd', { waitUntil: 'hydration' })

      const installCommandContainer = page.locator('[data-testid="install-command"]').first()
      const copyButton = installCommandContainer.locator('button')

      await copyButton.focus()
      await expect(copyButton).toBeFocused()

      await copyButton.click()

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:check/)

      // Verify clipboard content contains the install command
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/install is-odd|add is-odd/i)

      await expect(page.locator('.nuxt-announcer [aria-live="polite"]')).toContainText(
        'Install command copied',
      )

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:copy/, {
        timeout: 5000,
      })
      await expect(copyButton.locator('span[aria-hidden="true"]')).not.toHaveClass(/i-lucide:check/)
    })
  })

  test.describe('Run Command Copy', () => {
    test('copy button is accessible and keyboard discoverable', async ({ page, goto }) => {
      await goto('/package/vite', { waitUntil: 'hydration' })

      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const runCommandContainer = page.locator('[data-testid="run-command"]').first()
      await expect(runCommandContainer).toBeVisible({ timeout: 20000 })

      // Copy button should be in the DOM and accessible to screen readers
      const copyButton = runCommandContainer.locator('button')
      await expect(copyButton).toBeAttached()

      // Focus the button to verify it's keyboard accessible
      await copyButton.focus()
      await expect(copyButton).toBeFocused()
    })

    test('clicking copy button copies run command and shows confirmation', async ({
      page,
      goto,
      context,
    }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])

      await goto('/package/vite', { waitUntil: 'hydration' })
      await expect(page.locator('h1')).toContainText('vite', { timeout: 15000 })

      await expandAdditionalCommands(page)

      const runCommandContainer = page.locator('[data-testid="run-command"]').first()
      await expect(runCommandContainer).toBeVisible({ timeout: 20000 })

      const copyButton = runCommandContainer.locator('button')

      await copyButton.focus()
      await expect(copyButton).toBeFocused()

      await copyButton.click()

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:check/)

      // Verify clipboard content contains the run command
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardContent).toMatch(/npx vite/i)

      await expect(page.locator('.nuxt-announcer [aria-live="polite"]')).toContainText(
        'Run command copied',
      )

      await expect(copyButton.locator('span[aria-hidden="true"]')).toHaveClass(/i-lucide:copy/, {
        timeout: 5000,
      })
      await expect(copyButton.locator('span[aria-hidden="true"]')).not.toHaveClass(/i-lucide:check/)
    })
  })
})
