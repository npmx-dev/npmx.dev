import { expect, test } from './test-utils'

test.describe('npmjs.com URL Compatibility', () => {
  test.describe('Package Pages', () => {
    test('/package/vue → package page', async ({ page, goto }) => {
      await goto('/package/vue', { waitUntil: 'domcontentloaded' })

      // Should show package name
      await expect(page.locator('h1')).toContainText('vue')
      // Should have version badge
      await expect(
        page
          .locator('[data-testid="version-selector-button"]')
          .locator('text=/\\d+\\.\\d+\\.\\d+/'),
      ).toBeVisible()
    })

    test('/package/@nuxt/kit → scoped package page', async ({ page, goto }) => {
      await goto('/package/@nuxt/kit', { waitUntil: 'domcontentloaded' })

      // Should show scoped package name
      await expect(page.locator('h1')).toContainText('@nuxt/kit')
    })

    test('/package/vue/v/3.5.27 → specific version', async ({ page, goto }) => {
      await goto('/package/vue/v/3.5.27', { waitUntil: 'domcontentloaded' })

      // Should show package name
      await expect(page.locator('h1')).toContainText('vue')
      // Should show the specific version
      await expect(
        page.locator('[data-testid="version-selector-button"]').locator('text=3.5.27'),
      ).toBeVisible()
    })

    test('/package/@nuxt/kit/v/3.20.0 → scoped package specific version', async ({
      page,
      goto,
    }) => {
      await goto('/package/@nuxt/kit/v/3.20.0', { waitUntil: 'domcontentloaded' })

      // Should show scoped package name
      await expect(page.locator('h1')).toContainText('@nuxt/kit')
      // Should show the specific version (or "not latest" indicator)
      await expect(page.locator('text=3.20.0').first()).toBeVisible()
    })

    test('/package/nonexistent-pkg-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/package/nonexistent-pkg-12345', { waitUntil: 'domcontentloaded' })

      // Should show error state - look for the heading specifically
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible()
    })
  })

  test.describe('Root Package Short-URLs (Redirects)', () => {
    test('/vue redirects to /package/vue', async ({ page, goto }) => {
      await goto('/vue', { waitUntil: 'domcontentloaded' })

      // Verifies the browser ended up on the canonical route
      await expect(page).toHaveURL(/\/package\/vue$/)
      await expect(page.locator('h1')).toContainText('vue')
    })

    test('/@nuxt/kit redirects to /package/@nuxt/kit', async ({ page, goto }) => {
      await goto('/@nuxt/kit', { waitUntil: 'domcontentloaded' })

      await expect(page).toHaveURL(/\/package\/@nuxt\/kit$/)
      await expect(page.locator('h1')).toContainText('@nuxt/kit')
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
    test('/~qwerzl → user profile', async ({ page, goto }) => {
      await goto('/~qwerzl', { waitUntil: 'hydration' })

      // Should show username
      await expect(page.locator('h1')).toContainText('~qwerzl')

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

    test('restores shareable filters and columns from the URL', async ({ page, goto }) => {
      await goto(
        '/org/nuxt?q=framework&search=description&downloadRange=10k-100k&security=warnings&updatedWithin=quarter&columns=name,version,maintainers',
        { waitUntil: 'hydration' },
      )

      await page.getByRole('button', { name: 'Filters' }).click()
      await expect(page.getByRole('button', { name: 'Description' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await expect(page.getByRole('textbox', { name: 'Search' })).toHaveValue('framework')
      await expect(page.getByRole('radio', { name: '10K - 100K' })).toBeChecked()
      await expect(page.getByRole('radio', { name: 'With warnings' })).toBeChecked()
      await expect(page.getByRole('radio', { name: 'Past 3 months' })).toBeChecked()

      await page.getByRole('button', { name: 'Table view' }).click()
      await page.getByRole('button', { name: 'Columns' }).click()
      await expect(page.getByRole('checkbox', { name: 'Version' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: 'Description' })).not.toBeChecked()
      await expect(page.getByRole('checkbox', { name: 'Maintainers' })).toBeChecked()
    })

    test('writes organization filters and columns to the URL', async ({ page, goto }) => {
      await goto('/org/nuxt', { waitUntil: 'hydration' })

      await page.getByRole('button', { name: 'Filters' }).click()
      await page.getByRole('button', { name: 'Description' }).click()
      await page.getByRole('textbox', { name: 'Search' }).fill('grammar')
      await page.getByText('10K - 100K', { exact: true }).click()
      await page.getByText('Past 3 months', { exact: true }).click()

      await expect
        .poll(() => {
          const query = new URL(page.url()).searchParams
          return {
            q: query.get('q'),
            search: query.get('search'),
            downloadRange: query.get('downloadRange'),
            updatedWithin: query.get('updatedWithin'),
          }
        })
        .toEqual({
          q: 'grammar',
          search: 'description',
          downloadRange: '10k-100k',
          updatedWithin: 'quarter',
        })

      await page.getByRole('button', { name: 'Table view' }).click()
      await page.getByRole('button', { name: 'Columns' }).click()
      await page.getByRole('checkbox', { name: 'Maintainers' }).check()
      await page.getByRole('checkbox', { name: 'Description' }).uncheck()

      const expectedColumns = 'name,version,downloads,updated,maintainers'
      await expect.poll(() => new URL(page.url()).searchParams.get('columns')).toBe(expectedColumns)

      await goto('/org/nuxt', { waitUntil: 'hydration' })
      await expect.poll(() => new URL(page.url()).searchParams.get('columns')).toBe(expectedColumns)
      await page.getByRole('button', { name: 'Columns' }).click()
      await expect(page.getByRole('checkbox', { name: 'Maintainers' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: 'Description' })).not.toBeChecked()

      const defaultColumns = 'name,version,description,downloads,updated'
      await goto(`/org/nuxt?columns=${defaultColumns}`, { waitUntil: 'hydration' })
      await expect.poll(() => new URL(page.url()).searchParams.get('columns')).toBe(defaultColumns)
      await page.getByRole('button', { name: 'Columns' }).click()
      await expect(page.getByRole('checkbox', { name: 'Description' })).toBeChecked()
      await expect(page.getByRole('checkbox', { name: 'Maintainers' })).not.toBeChecked()
    })

    test('falls back from invalid organization view parameters', async ({ page, goto }) => {
      await goto(
        '/org/nuxt?search=invalid&downloadRange=invalid&security=invalid&updatedWithin=invalid&columns=invalid',
        { waitUntil: 'hydration' },
      )

      await expect
        .poll(() => {
          const query = new URL(page.url()).searchParams
          return {
            search: query.get('search'),
            downloadRange: query.get('downloadRange'),
            security: query.get('security'),
            updatedWithin: query.get('updatedWithin'),
            columns: query.get('columns'),
          }
        })
        .toEqual({
          search: null,
          downloadRange: null,
          security: null,
          updatedWithin: null,
          columns: null,
        })
    })

    test('/org/nonexistent-org-12345 → 404 handling', async ({ page, goto }) => {
      await goto('/org/nonexistent-org-12345', { waitUntil: 'domcontentloaded' })

      // Should show 404 error page
      await expect(page.locator('h1')).toContainText('Organization not found')
    })
  })

  test.describe('npmjs.com activeTab=versions Compatibility', () => {
    test('/package/vue?activeTab=versions → /package/vue/versions', async ({ page, goto }) => {
      await goto('/package/vue?activeTab=versions', { waitUntil: 'domcontentloaded' })

      await expect(page).toHaveURL(/\/package\/vue\/versions$/)
      await expect(page.locator('h1')).toContainText('Version History')
    })

    test('/package/@nuxt/kit?activeTab=versions → /package/@nuxt/kit/versions', async ({
      page,
      goto,
    }) => {
      await goto('/package/@nuxt/kit?activeTab=versions', { waitUntil: 'domcontentloaded' })

      await expect(page).toHaveURL(/\/package\/@nuxt\/kit\/versions$/)
      await expect(page.locator('h1')).toContainText('Version History')
    })
  })

  test.describe('Edge Cases', () => {
    test('package name with dots: /package/lodash.merge', async ({ page, goto }) => {
      await goto('/package/lodash.merge', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('lodash.merge')
    })

    test('package name with hyphens: /package/is-odd', async ({ page, goto }) => {
      await goto('/package/is-odd', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('is-odd')
    })

    test('scoped package with hyphens: /package/@types/node', async ({ page, goto }) => {
      await goto('/package/@types/node', { waitUntil: 'domcontentloaded' })

      await expect(page.locator('h1')).toContainText('@types/node')
    })
  })
})
