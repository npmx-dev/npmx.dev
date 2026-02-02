import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('npmjs.com URL Compatibility', () => {
  // TODO: these tests depend on external npm registry API - we should add data fixtures
  test.describe.configure({ retries: 2 })

  test.describe('Package Pages', () => {
    test('/package/vue → package page', async ({ page, goto }) => {
      await goto('/package/vue', { waitUntil: 'domcontentloaded' })

      // Should show package name
      await expect(page.locator('h1')).toContainText('vue')
      // Should have version badge
      await expect(page.locator('main header').locator('text=/v\\d+\\.\\d+/')).toBeVisible()
    })

    test('/package/@nuxt/kit → scoped package page', async ({ page, goto }) => {
      await goto('/package/@nuxt/kit', { waitUntil: 'domcontentloaded' })

      // Should show scoped package name
      await expect(page.locator('h1')).toContainText('@nuxt/kit')
    })

    test('/package/vue/v/3.4.0 → specific version', async ({ page, goto }) => {
      await goto('/package/vue/v/3.4.0', { waitUntil: 'domcontentloaded' })

      // Should show package name
      await expect(page.locator('h1')).toContainText('vue')
      // Should show the specific version
      await expect(page.locator('text=v3.4.0')).toBeVisible()
    })

    test('/package/@nuxt/kit/v/3.0.0 → scoped package specific version', async ({ page, goto }) => {
      await goto('/package/@nuxt/kit/v/3.0.0', { waitUntil: 'domcontentloaded' })

      // Should show scoped package name
      await expect(page.locator('h1')).toContainText('@nuxt/kit')
      // Should show the specific version (or "not latest" indicator)
      await expect(page.locator('text=v3.0.0').first()).toBeVisible()
    })

    test('/package/nonexistent-pkg-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/package/nonexistent-pkg-12345', { waitUntil: 'domcontentloaded' })

      // Should show error state - look for the heading specifically
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible()
    })
  })

  test.describe('Search Pages', () => {
    test('/search?q=vue → search results', async ({ page, goto }) => {
      await goto('/search?q=vue', { waitUntil: 'domcontentloaded' })

      // Should show search input with query
      await expect(page.locator('input[type="search"]')).toHaveValue('vue')
      // Should show results count
      await expect(page.locator('text=/found \\d+/i')).toBeVisible()
    })

    test('/search?q=keywords:framework → keyword search', async ({ page, goto }) => {
      await goto('/search?q=keywords:framework', { waitUntil: 'domcontentloaded' })

      // Should show search input with query
      await expect(page.locator('input[type="search"]')).toHaveValue('keywords:framework')
      // Should show results
      await expect(page.locator('text=/found \\d+/i')).toBeVisible()
    })

    test('/search → empty search page', async ({ page, goto }) => {
      await goto('/search', { waitUntil: 'domcontentloaded' })

      // Should show empty state prompt
      await expect(page.locator('text=/start typing/i')).toBeVisible()
    })
  })

  test.describe('User Profile Pages', () => {
    test('/~sindresorhus → user profile', async ({ page, goto }) => {
      await goto('/~sindresorhus', { waitUntil: 'hydration' })

      // Should show username
      await expect(page.locator('h1')).toContainText('~sindresorhus')

      await expect(page.locator('text=/\\d+\\s+public\\s+package/i').first()).toBeVisible({
        timeout: 15000,
      })
    })

    test('/~nonexistent-user-12345 → empty user handling', async ({ page, goto }) => {
      await goto('/~nonexistent-user-12345', { waitUntil: 'domcontentloaded' })

      // Should show username in header
      await expect(page.locator('h1')).toContainText('~nonexistent-user-12345')
      // Should show empty state message
      await expect(page.getByText('No public packages found for')).toBeVisible()
    })
  })

  test.describe('Organization Pages', () => {
    test('/org/nuxt → organization page', async ({ page, goto }) => {
      await goto('/org/nuxt', { waitUntil: 'domcontentloaded' })

      // Should show org name
      await expect(page.locator('h1')).toContainText('@nuxt')
      // Should show packages heading
      await expect(page.getByRole('heading', { name: 'Packages' })).toBeVisible()
    })

    test('/org/nonexistent-org-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/org/nonexistent-org-12345', { waitUntil: 'domcontentloaded' })

      // Should show 404 error page
      await expect(page.locator('h1')).toContainText('Organization not found')
    })
  })

  test.describe('Edge Cases', () => {
    test('package name with dots: /package/lodash.merge', async ({ page, goto }) => {
      await goto('/package/lodash.merge', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('lodash.merge')
    })

    test('package name with hyphens: /package/date-fns', async ({ page, goto }) => {
      await goto('/package/date-fns', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('date-fns')
    })

    test('scoped package with hyphens: /package/@types/node', async ({ page, goto }) => {
      await goto('/package/@types/node', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('@types/node')
    })
  })
})
