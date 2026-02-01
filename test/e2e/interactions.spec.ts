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

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({
      timeout: 15000,
    })

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

    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({
      timeout: 15000,
    })

    const headerSearchInput = page.locator('#header-search')
    await expect(headerSearchInput).toBeFocused()
  })
})

test.describe('Keyboard Shortcuts', () => {
  test('"c" navigates to /compare', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    await page.keyboard.press('c')

    await expect(page).toHaveURL(/\/compare/)
  })

  test('"c" does not navigate when any modifier key is pressed', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    await page.keyboard.press('Shift+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Control+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Alt+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Meta+c')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('ControlOrMeta+Shift+c')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('"c" on package page navigates to /compare with package pre-filled', async ({
    page,
    goto,
  }) => {
    await goto('/vue', { waitUntil: 'hydration' })

    await page.keyboard.press('c')

    // Should navigate to /compare with the package in the query
    await expect(page).toHaveURL(/\/compare\?packages=vue/)
  })

  test('"c" does not navigate when search input is focused', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('#header-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.press('c')

    // Should still be on settings, not navigated to compare
    await expect(page).toHaveURL(/\/settings/)
    // The 'c' should have been typed into the input
    await expect(searchInput).toHaveValue('c')
  })

  test('"c" on package page does not navigate when any modifier key is pressed', async ({
    page,
    goto,
  }) => {
    await goto('/vue', { waitUntil: 'hydration' })

    await page.keyboard.press('Shift+c')
    await expect(page).toHaveURL(/\/vue/)
    await page.keyboard.press('Control+c')
    await expect(page).toHaveURL(/\/vue/)
    await page.keyboard.press('Alt+c')
    await expect(page).toHaveURL(/\/vue/)
    await page.keyboard.press('Meta+c')
    await expect(page).toHaveURL(/\/vue/)
    await page.keyboard.press('ControlOrMeta+Shift+c')
    await expect(page).toHaveURL(/\/vue/)
  })

  test('"," navigates to /settings', async ({ page, goto }) => {
    await goto('/compare', { waitUntil: 'hydration' })

    await page.keyboard.press(',')

    await expect(page).toHaveURL(/\/settings/)
  })

  test('"," does not navigate when any modifier key is pressed', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const searchInput = page.locator('#header-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.press('Shift+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Control+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Alt+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('Meta+,')
    await expect(page).toHaveURL(/\/settings/)
    await page.keyboard.press('ControlOrMeta+Shift+,')
    await expect(page).toHaveURL(/\/settings/)
  })

  test('"," does not navigate when search input is focused', async ({ page, goto }) => {
    await goto('/compare', { waitUntil: 'hydration' })

    const searchInput = page.locator('#header-search')
    await searchInput.focus()
    await expect(searchInput).toBeFocused()

    await page.keyboard.press(',')

    // Should still be on compare, not navigated to settings
    await expect(page).toHaveURL(/\/compare/)
    // The ',' should have been typed into the input
    await expect(searchInput).toHaveValue(',')
  })
})
