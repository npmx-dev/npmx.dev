import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('API Documentation Pages', () => {
  test('docs page loads and shows content for a package', async ({ page, goto }) => {
    // Use a small, stable package with TypeScript types
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'networkidle' })

    // Page title should include package name
    await expect(page).toHaveTitle(/ufo.*docs/i)

    // Header should show package name and version
    await expect(page.locator('header').getByText('ufo')).toBeVisible()
    await expect(page.locator('header').getByText('1.6.3')).toBeVisible()

    // API Docs badge should be visible
    await expect(page.locator('text=API Docs')).toBeVisible()

    // Should have documentation content
    const docsContent = page.locator('.docs-content')
    await expect(docsContent).toBeVisible()

    // Should have at least one function documented
    await expect(page.locator('.docs-badge--function').first()).toBeVisible()
  })

  test('docs page shows TOC sidebar on desktop', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'networkidle' })

    // TOC sidebar should be visible (on desktop viewport)
    const tocSidebar = page.locator('aside')
    await expect(tocSidebar).toBeVisible()

    // Should have "Contents" heading
    await expect(tocSidebar.getByText('Contents')).toBeVisible()

    // Should have section links (Functions, etc.)
    await expect(tocSidebar.locator('a[href="#section-function"]')).toBeVisible()
  })

  test('TOC links navigate to sections', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'networkidle' })

    // Click on Functions in TOC
    const functionsLink = page.locator('aside a[href="#section-function"]')
    await functionsLink.click()

    // URL should have the hash
    await expect(page).toHaveURL(/#section-function/)

    // Section should be scrolled into view
    const functionSection = page.locator('#section-function')
    await expect(functionSection).toBeInViewport()
  })

  test('clicking symbol name scrolls to symbol', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'networkidle' })

    // Find a symbol link in the TOC
    const symbolLink = page.locator('aside a[href^="#function-"]').first()
    const href = await symbolLink.getAttribute('href')

    // Click the symbol link
    await symbolLink.click()

    // URL should have the hash
    await expect(page).toHaveURL(new RegExp(href!.replace('#', '#')))
  })

  test('docs page without version redirects to latest', async ({ page, goto }) => {
    await goto('/docs/ufo', { waitUntil: 'networkidle' })

    // Should redirect to include version
    await expect(page).toHaveURL(/\/docs\/ufo\/v\//)
  })

  test('package link in header navigates to package page', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'networkidle' })

    // Click on package name in header
    const packageLink = page.locator('header a').filter({ hasText: 'ufo' })
    await packageLink.click()

    // Should navigate to package page (URL ends with /ufo)
    await expect(page).toHaveURL(/\/ufo$/)
  })

  test('docs page handles package gracefully when types unavailable', async ({ page, goto }) => {
    // Use a simple JS package - the page should load without crashing
    // regardless of whether it has types or shows an error state
    await goto('/docs/is-odd/v/3.0.1', { waitUntil: 'networkidle' })

    // Header should always show the package name
    await expect(page.locator('header').getByText('is-odd')).toBeVisible()

    // Page should be in one of two states:
    // 1. Shows "not available" / error message
    // 2. Shows actual docs content (if types were found)
    const errorState = page.locator('text=/not available|could not generate/i')
    const docsContent = page.locator('.docs-content')

    // One of these should be visible
    await expect(errorState.or(docsContent)).toBeVisible()
  })
})

test.describe('Version Selector', () => {
  test('version selector dropdown shows versions', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'hydration' })

    // Find and click the version selector button (wait for it to be visible)
    const versionButton = page.locator('header button').filter({ hasText: '1.6.3' })
    await expect(versionButton).toBeVisible({ timeout: 10000 })

    await versionButton.click()

    // Dropdown should appear with version options
    const dropdown = page.locator('[role="listbox"]')
    await expect(dropdown).toBeVisible()

    // Should show multiple versions
    const versionOptions = dropdown.locator('[role="option"]')
    await expect(versionOptions.first()).toBeVisible()
  })

  test('selecting a version navigates to that version', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'hydration' })

    // Find and click the version selector button (wait for it to be visible)
    const versionButton = page.locator('header button').filter({ hasText: '1.6.3' })
    await expect(versionButton).toBeVisible({ timeout: 10000 })

    await versionButton.click()

    // Find a version link that's not the current version by checking the href
    const versionLinks = page.locator('[role="option"] a[href*="/docs/ufo/v/"]')
    const count = await versionLinks.count()

    // Find first link that doesn't point to 1.6.3
    let targetHref: string | null = null
    for (let i = 0; i < count; i++) {
      const href = await versionLinks.nth(i).getAttribute('href')
      if (href && !href.includes('/v/1.6.3')) {
        targetHref = href
        await versionLinks.nth(i).click()
        break
      }
    }

    // Skip if no other versions available
    if (!targetHref) {
      test.skip()
      return
    }

    // URL should match the href we clicked
    await expect(page).toHaveURL(new RegExp(targetHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  })

  test('escape key closes version dropdown', async ({ page, goto }) => {
    await goto('/docs/ufo/v/1.6.3', { waitUntil: 'hydration' })

    // Wait for version button to be visible
    const versionButton = page.locator('header button').filter({ hasText: '1.6.3' })
    await expect(versionButton).toBeVisible({ timeout: 10000 })

    await versionButton.click()

    const dropdown = page.locator('[role="listbox"]')
    await expect(dropdown).toBeVisible()

    // Press escape
    await page.keyboard.press('Escape')

    // Dropdown should close
    await expect(dropdown).not.toBeVisible()
  })
})
