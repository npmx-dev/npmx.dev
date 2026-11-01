import { expect, test } from './test-utils'

test.describe('Settings reset', () => {
  test('moves focus into the confirmation and Escape cancels it', async ({ page, goto }) => {
    await goto('/settings', { waitUntil: 'hydration' })

    const trigger = page.getByRole('button', { name: 'Reset all settings' })
    await trigger.click()

    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused()

    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(/\/settings/)
    await expect(trigger).toBeFocused()
  })
})
