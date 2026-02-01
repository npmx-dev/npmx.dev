import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Package Page', () => {
  test('/vue → package manager select dropdown works', async ({ page, goto }) => {
    await goto('/vue', { waitUntil: 'hydration' })

    await expect(page.locator('h1')).toContainText('vue', { timeout: 15000 })

    const packageManagerButton = page.locator('button[aria-haspopup="listbox"]').first()
    await expect(packageManagerButton).toBeVisible()

    // Open dropdown
    await packageManagerButton.click()
    const packageManagerDropdown = page.locator('[role="listbox"]')
    await expect(packageManagerDropdown).toBeVisible({ timeout: 5000 })

    // Arrow keys navigate the listbox
    await packageManagerButton.press('ArrowDown')
    const firstDescendant = await packageManagerDropdown.getAttribute('aria-activedescendant')
    await packageManagerButton.press('ArrowDown')
    const secondDescendant = await packageManagerDropdown.getAttribute('aria-activedescendant')
    expect(secondDescendant).not.toBe(firstDescendant)

    // Escape closes dropdown and returns focus
    await packageManagerButton.press('Escape')
    await expect(packageManagerDropdown).not.toBeVisible()
    await expect(packageManagerButton).toBeFocused()

    // Enter selects option and closes dropdown
    await packageManagerButton.click()
    await expect(packageManagerDropdown).toBeVisible({ timeout: 5000 })
    await packageManagerButton.press('ArrowDown')
    await packageManagerButton.press('Enter')
    await expect(packageManagerDropdown).not.toBeVisible()
  })
})
