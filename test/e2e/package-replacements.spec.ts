import { expect, test } from './test-utils'

test.describe('Package Replacement Suggestions', () => {
  test('/package/strip-ansi shows a replacement suggestion with a link to e18e docs', async ({
    page,
    goto,
  }) => {
    await goto('/package/strip-ansi', { waitUntil: 'hydration' })

    // Wait for the package page to load
    await expect(page.locator('h1')).toContainText('strip-ansi', { timeout: 15_000 })

    // The replacement component renders a "Learn more" anchor driven by resolveReplacementUrl.
    // For strip-ansi the url.type is 'e18e', so the href resolves to:
    // https://e18e.dev/docs/replacements/strip-ansi
    //
    // useLazyFetch is used, so the suggestion arrives after hydration — use a generous timeout.
    const replacementLink = page.locator('a[href="https://e18e.dev/docs/replacements/strip-ansi"]')
    await expect(replacementLink).toBeVisible({ timeout: 15_000 })
  })
})
