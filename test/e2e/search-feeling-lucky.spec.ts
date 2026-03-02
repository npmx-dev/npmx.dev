import { expect, test } from './test-utils'

test.describe('Search "I\'m Feeling Lucky" Redirect', () => {
  test('direct URL access with "!" should redirect to package', async ({ page, goto }) => {
    await goto('/search?q=nuxt!', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/package\/nuxt$/, { timeout: 15000 })
  })

  test('normal search query (without "!") should not redirect', async ({ page, goto }) => {
    await goto('/search?q=nuxt', { waitUntil: 'hydration' })
    await expect(page.locator('[data-result-index="0"]').first()).toBeVisible({ timeout: 15000 })
    await expect(page).toHaveURL(/\/search\?q=nuxt/)
  })
})
