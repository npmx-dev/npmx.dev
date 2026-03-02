import { expect, test } from './test-utils'

test.describe('Homepage Picks', () => {
  test('displays 4 picks with highlighted letters', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    // Use aria-label to target the picks nav specifically (not the header nav)
    const picksNav = page.getByRole('navigation', { name: /npmx picks/i })
    await expect(picksNav).toBeVisible({ timeout: 15000 })

    const pickItems = picksNav.locator('ul > li')
    await expect(pickItems).toHaveCount(4)

    // Each pick should contain a bold highlighted letter
    for (let i = 0; i < 4; i++) {
      const highlightedLetter = pickItems.nth(i).locator('span.font-semibold')
      await expect(highlightedLetter).toBeVisible()
    }

    // Each pick should be a link to a package page
    for (let i = 0; i < 4; i++) {
      const link = pickItems.nth(i).locator('a')
      const href = await link.getAttribute('href')
      expect(href).toMatch(/^\/package\//)
    }
  })

  test('pick links navigate to package pages', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })

    const picksNav = page.getByRole('navigation', { name: /npmx picks/i })
    await expect(picksNav).toBeVisible({ timeout: 15000 })

    const firstLink = picksNav.locator('ul > li a').first()
    await firstLink.click()
    await expect(page).toHaveURL(/\/package\//)
  })
})
