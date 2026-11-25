import { expect, test } from './test-utils'

test.describe('Auth session hint migration', () => {
  test('fresh anonymous visitors skip /api/auth/session across reloads', async ({ page, goto }) => {
    let requests = 0
    await page.route('**/api/auth/session', async route => {
      requests++
      await route.fulfill({ json: null })
    })

    await goto('/about', { waitUntil: 'hydration' })
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('npmx-auth-hint-migrated')))
      .toBe('1')
    expect(requests).toBe(0)

    await page.reload()
    await expect(page.locator('main')).toBeVisible()
    expect(requests).toBe(0)
  })

  test('pre-existing settings trigger one startup migration check', async ({ page, goto }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('auth-migration-test-seeded') !== '1') {
        localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
        localStorage.setItem('auth-migration-test-seeded', '1')
      }
    })

    let requests = 0
    await page.route('**/api/auth/session', async route => {
      requests++
      await route.fulfill({ json: null })
    })

    await goto('/about', { waitUntil: 'hydration' })
    await expect.poll(() => requests).toBe(1)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('npmx-auth-hint-migrated')))
      .toBe('1')

    await page.reload()
    await expect(page.locator('main')).toBeVisible()
    expect(requests).toBe(1)
  })
})
