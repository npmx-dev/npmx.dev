import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Search Pages', () => {
  // TODO: these tests depend on external npm registry API - we should add data fixtures
  test.describe.configure({ retries: 2 })
  test('/search?q=vue → keyboard navigation (arrow keys + enter)', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    const firstResult = page.locator('[data-result-index="0"]').first()
    await expect(firstResult).toBeVisible()

    // Global keyboard navigation works regardless of focus
    // ArrowDown selects the next result
    await page.keyboard.press('ArrowDown')

    // ArrowUp selects the previous result
    await page.keyboard.press('ArrowUp')

    // Enter navigates to the selected result
    // URL is /vue not /package/vue (cleaner URLs)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/vue/)
  })

  test('/search?q=vue → "/" focuses the search input from results', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'hydration' })

    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    await page.locator('[data-result-index="0"]').first().focus()
    await page.keyboard.press('/')
    await expect(page.locator('input[type="search"]')).toBeFocused()
  })

  test('/ (homepage) → search, keeps focus on search input', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const homeSearchInput = page.locator('#home-search')
    await homeSearchInput.click()
    await page.keyboard.type('vue')

    // Wait for navigation to /search (debounce is 250ms)
    await expect(page).toHaveURL(/\/search/, { timeout: 10000 })

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({ timeout: 15000 })

    // Home search input should be gone (we're on /search now)
    await expect(homeSearchInput).not.toBeVisible()

    // Header search input should now exist and be focused
    const headerSearchInput = page.locator('#header-search')
    await expect(headerSearchInput).toBeVisible()
    await expect(headerSearchInput).toBeFocused()
  })

  test('/settings → search, keeps focus on search input', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeVisible()

    await searchInput.click()
    await searchInput.fill('vue')

    await expect(page).toHaveURL(/\/search/, { timeout: 10000 })

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({ timeout: 15000 })

    const headerSearchInput = page.locator('#header-search')
    await expect(headerSearchInput).toBeFocused()
  })
})
