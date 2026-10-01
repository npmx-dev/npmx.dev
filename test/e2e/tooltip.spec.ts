import { expect, test } from './test-utils'

test.describe('Tooltip', () => {
  test('stays hidden when focus returns to a trigger that was clicked', async ({ page, goto }) => {
    await goto('/package/vue', { waitUntil: 'hydration' })

    const badge = page.locator('[tabindex="0"]', { hasText: 'ESM' }).first()
    await expect(badge).toBeVisible({ timeout: 15000 })

    const tooltip = page.locator('[role="tooltip"]')

    await badge.hover()
    await expect(tooltip).toBeVisible()

    // a click leaves the trigger focused, the way clicking a playground link does
    await badge.click()
    await expect(badge).toBeFocused()

    await page.mouse.move(0, 0)
    await expect(tooltip).toBeHidden()

    // returning to the tab refocuses that element, which fires `focusin` again
    await badge.evaluate((element: HTMLElement) => {
      element.blur()
      element.focus()
    })
    await expect(badge).toBeFocused()

    // the focus came from a pointer, so the tooltip must stay hidden
    await expect(tooltip).toBeHidden()
  })
})
