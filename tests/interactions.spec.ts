import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Search Pages', () => {
  test('/search?q=vue → keyboard navigation (arrow keys + enter)', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    const searchInput = page.locator('input[type="search"]')
    await expect(searchInput).toBeFocused()

    const firstResult = page.locator('[data-result-index="0"]').first()
    await expect(firstResult).toBeVisible()

    // First result is selected by default, Enter navigates to it
    // URL is /vue not /package/vue (cleaner URLs)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/vue/)

    await page.goBack()
    // Search input is autofocused on mount
    await expect(searchInput).toBeFocused()
    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    // ArrowDown changes visual selection but keeps focus in input
    await page.keyboard.press('ArrowDown')
    await expect(searchInput).toBeFocused()

    // Enter navigates to the now-selected second result
    await page.keyboard.press('Enter')
    // Second result could be vue-router, vuex, etc - just check we navigated away
    await expect(page).not.toHaveURL(/\/search/)
  })

  test('/search?q=vue → "/" focuses the search input from results', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    await page.locator('[data-result-index="0"]').first().focus()
    await page.keyboard.press('/')
    await expect(page.locator('input[type="search"]')).toBeFocused()
  })
})
