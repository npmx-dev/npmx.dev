import { expect, test } from './test-utils'

test.describe('Search pkg@version navigation', () => {
  test('esbuild@0.25.12 → navigates to exact version page', async ({ page, goto }) => {
    await goto('/search', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('esbuild@0.25.12')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/package\/esbuild\/v\/0\.25\.12/)
  })

  test('@angular/core@18.0.0 → navigates to scoped exact version page', async ({ page, goto }) => {
    await goto('/search', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('@angular/core@18.0.0')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/package\/@angular\/core\/v\/18\.0\.0/)
  })

  test('react@^18.0.0 → navigates to package page with semver filter', async ({ page, goto }) => {
    await goto('/search', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('react@^18.0.0')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/package\/react\?semver=/)
    await expect(page).toHaveURL(/#versions/)
  })

  test('@angular/core@^18 || ^19 → navigates to package page with semver filter', async ({
    page,
    goto,
  }) => {
    await goto('/search', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('@angular/core@^18 || ^19')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/package\/@angular\/core\?semver=/)
    await expect(page).toHaveURL(/#versions/)
  })

  test('nuxt@latest → navigates to package page with semver filter for dist-tag', async ({
    page,
    goto,
  }) => {
    await goto('/search', { waitUntil: 'hydration' })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.fill('nuxt@latest')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/package\/nuxt\?semver=latest/)
    await expect(page).toHaveURL(/#versions/)
  })

  test('plain package name without @ version → does not trigger version navigation', async ({
    page,
    goto,
  }) => {
    await goto('/search?q=vue', { waitUntil: 'hydration' })

    // Wait for search results to load
    await expect(page.locator('text=/found \\d+|showing \\d+/i').first()).toBeVisible({
      timeout: 15000,
    })

    const searchInput = page.locator('input[type="search"]')
    await searchInput.focus()
    await page.keyboard.press('Enter')

    // Should navigate to the package page (exact match), not a version page
    await expect(page).toHaveURL(/\/package\/vue$/)
  })
})
