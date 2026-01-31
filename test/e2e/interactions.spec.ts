import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Search Pages', () => {
  test('/search?q=vue → keyboard navigation (arrow keys + enter)', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    const firstResult = page.locator('[data-result-index="0"]').first()
    await expect(firstResult).toBeVisible()

    const searchInput = page.locator('input[type="search"]')

    // ArrowDown changes visual selection but keeps focus in input
    await page.keyboard.press('ArrowDown')
    await expect(searchInput).toBeFocused()

    // ArrowUp goes back to first result
    await page.keyboard.press('ArrowUp')
    await expect(searchInput).toBeFocused()

    // First result is selected, Enter navigates to it
    // URL is /vue not /package/vue (cleaner URLs)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/vue/)
  })

  test('/search?q=vue → "/" focuses the search input from results', async ({ page, goto }) => {
    await goto('/search?q=vue', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    await page.locator('[data-result-index="0"]').first().focus()
    await page.keyboard.press('/')
    await expect(page.locator('input[type="search"]')).toBeFocused()
  })

  test('/settings → search, keeps focus on search input', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'domcontentloaded' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('vue')

    await page.waitForURL(/\/search/)

    await expect(page.locator('text=/found \\d+/i')).toBeVisible()

    await expect(searchInput).toBeFocused()
  })
})
