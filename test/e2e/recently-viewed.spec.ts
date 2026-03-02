import { expect, test } from './test-utils'

test.describe('Recently Viewed', () => {
  test('visiting package, org, and user pages populates recently viewed on homepage', async ({
    page,
    goto,
  }) => {
    // Start with empty homepage — no recently viewed items
    await goto('/', { waitUntil: 'hydration' })
    await expect(page.locator('#recently-viewed-label')).not.toBeVisible()

    // Visit a package page — wait for install command to confirm data loaded
    await goto('/package/nuxt', { waitUntil: 'hydration' })
    await expect(page.locator('#get-started')).toBeVisible({ timeout: 15000 })

    // Visit an org page — wait for the package list to confirm data loaded
    await goto('/@nuxt', { waitUntil: 'hydration' })
    await expect(page.getByText(/public packages?/i)).toBeVisible({ timeout: 15000 })

    // Visit a user page — wait for package count to confirm data loaded
    await goto('/~qwerzl', { waitUntil: 'hydration' })
    await expect(page.getByText(/public packages?/i)).toBeVisible({ timeout: 15000 })

    // Go back to homepage — should see all three recently viewed items
    await goto('/', { waitUntil: 'hydration' })

    const recentNav = page.locator('nav[aria-labelledby="recently-viewed-label"]')
    await expect(recentNav).toBeVisible({ timeout: 10000 })

    const links = recentNav.locator('a')
    await expect(links).toHaveCount(3)

    // Most recent first
    await expect(links.nth(0)).toContainText('~qwerzl')
    await expect(links.nth(1)).toContainText('@nuxt')
    await expect(links.nth(2)).toContainText('nuxt')
  })
})
