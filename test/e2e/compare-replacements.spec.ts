import { expect, test } from './test-utils'

test.describe('Compare page - replacement suggestions', () => {
  test('shows "Consider no dep?" box for packages with native/simple replacements', async ({
    page,
    goto,
  }) => {
    await goto('/compare?packages=is-odd,is-even', { waitUntil: 'hydration' })

    const considerNoDepButton = await page.waitForSelector('button[aria-label="Add no dependency column to comparison"]', { 
      timeout: 15_000 
    })
    
    expect(considerNoDepButton).not.toBeNull()
  })

  test('does not show "Consider no dep?" box for packages without replacements', async ({
    page,
    goto,
  }) => {
    await goto('/compare?packages=nuxt,vue', { waitUntil: 'hydration' })

    await page.waitForTimeout(10000) 
    
    const considerNoDepButton = await page.querySelector('button[aria-label="Add no dependency column to comparison"]')
    
    expect(considerNoDepButton).toBeNull()
  })
})
