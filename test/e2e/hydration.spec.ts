import { expect, test } from './test-utils'

test.describe('Hydration', () => {
  test('/ (homepage) has no hydration mismatches', async ({ goto, hydrationErrors }) => {
    await goto('/', { waitUntil: 'hydration' })
    // await goto('/about', { waitUntil: 'hydration' })
    // await goto('/settings', { waitUntil: 'hydration' })

    expect(hydrationErrors).toEqual([])
  })
})
