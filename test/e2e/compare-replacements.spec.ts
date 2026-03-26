import { expect, test } from './test-utils'

test.describe('Compare page - replacement suggestions', () => {
  test('shows "Consider no dep?" box for packages with native/simple replacements', async ({
    page,
    goto,
  }) => {
    // is-odd has a 'simple' replacement in module-replacements v3
    await goto('/compare?packages=is-odd,is-even', { waitUntil: 'hydration' })

    // The suggestion box should appear after client-side fetch resolves
    // Button text comes from $t('package.replacement.consider_no_dep')
    const considerNoDepButton = page.getByRole('button', { name: /consider no dep/i })
    await expect(considerNoDepButton).toBeVisible({ timeout: 15_000 })
  })

  test('does not show "Consider no dep?" box for packages without replacements', async ({
    page,
    goto,
  }) => {
    await goto('/compare?packages=nuxt,vue', { waitUntil: 'hydration' })

    const considerNoDepButton = page.getByRole('button', { name: /consider no dep/i })
    await expect(considerNoDepButton).not.toBeVisible({ timeout: 10_000 })
  })
})
