import { expect, test } from './test-utils'

test.describe('Compare page - replacement suggestions', () => {
  test('shows "Consider no dep?" box for packages with native/simple replacements', async ({
    page,
    goto,
  }) => {
    await goto('/compare?packages=is-odd,is-even', { waitUntil: 'hydration' })

    const considerNoDepButton = await page.waitForSelector(
      'button[aria-label="Add no dependency column to comparison"]',
      {
        timeout: 15_000,
      },
    )

    expect(considerNoDepButton).not.toBeNull()
  })
})
