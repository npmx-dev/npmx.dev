import { expect, test } from '@nuxt/test-utils/playwright'

test('home page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot()
})

test('og image for home page', async ({ page }) => {
  await page.goto('/__og-image__/image/og.png')
  await expect(page).toHaveScreenshot()
})
