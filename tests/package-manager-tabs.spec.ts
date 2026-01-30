import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('Package Page', () => {
  test('/vue → package manager tabs use roving tabindex', async ({ page, goto }) => {
    await goto('/vue', { waitUntil: 'domcontentloaded' })

    const tablist = page.locator('[role="tablist"]').first()
    await expect(tablist).toBeVisible()

    const tabs = tablist.locator('[role="tab"]')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThan(1)

    const firstTab = tabs.first()
    await firstTab.focus()
    await expect(firstTab).toBeFocused()

    await page.keyboard.press('ArrowRight')

    const secondTab = tabs.nth(1)
    await expect(secondTab).toBeFocused()
    await expect(secondTab).toHaveAttribute('aria-selected', 'true')
    await expect(secondTab).toHaveAttribute('tabindex', '0')
    await expect(firstTab).toHaveAttribute('tabindex', '-1')

    const tabpanel = page.locator('[role="tabpanel"]').first()
    const controls = await secondTab.getAttribute('aria-controls')
    const panelId = await tabpanel.getAttribute('id')
    expect(controls).toBe(panelId)

    const labelledBy = await tabpanel.getAttribute('aria-labelledby')
    const tabId = await secondTab.getAttribute('id')
    expect(labelledBy).toBe(tabId)
  })
})
