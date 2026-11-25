import { expect, test } from './test-utils'

const MOCK_RELEASE_INFO = {
  type: 'release',
  provider: 'github',
  repo: 'nuxt/nuxt',
  link: 'https://github.com/nuxt/nuxt/releases',
}

const MOCK_RELEASES = [
  {
    id: 1,
    tag: 'v4.3.1',
    title: 'v4.3.1',
    publishedAt: '2026-01-15T12:00:00Z',
    prerelease: false,
    draft: false,
    url: 'https://github.com/nuxt/nuxt/releases/tag/v4.3.1',
    html: '<p>Bug fixes and performance improvements.</p>',
  },
]

test.describe('Package Changelog Pages', () => {
  for (const { path, expectedTitle, expectedOgTitle } of [
    {
      path: '/package-changelog/nuxt',
      expectedTitle: '<title>Changelog - nuxt - npmx</title>',
      expectedOgTitle: 'Changelog - nuxt - npmx',
    },
    {
      path: '/package-changelog/nuxt/v/4.3.1',
      expectedTitle: '<title>Changelog - nuxt@4.3.1 - npmx</title>',
      expectedOgTitle: 'Changelog - nuxt@4.3.1 - npmx',
    },
    {
      path: '/changelog/nuxt',
      expectedTitle: '<title>Changelog - nuxt - npmx</title>',
      expectedOgTitle: 'Changelog - nuxt - npmx',
    },
    {
      path: '/changelog/nuxt/v/4.3.1',
      expectedTitle: '<title>Changelog - nuxt@4.3.1 - npmx</title>',
      expectedOgTitle: 'Changelog - nuxt@4.3.1 - npmx',
    },
    {
      path: '/changelog/@nuxt/kit',
      expectedTitle: '<title>Changelog - @nuxt&#x2F;kit - npmx</title>',
      expectedOgTitle: 'Changelog - @nuxt/kit - npmx',
    },
  ]) {
    test(`${path} is a client-only shell that is not indexed`, async ({ page }) => {
      const response = await page.request.get(path)

      expect(response.headers()['x-robots-tag']).toBe('noindex')
      expect(await response.text()).toContain('data-ssr="false"')
    })

    test(`${path} renders meta tags for link preview bots`, async ({ page }) => {
      const response = await page.request.get(path, {
        headers: { 'user-agent': 'Slackbot-LinkExpanding 1.0' },
      })
      const html = await response.text()

      expect(response.headers()['x-robots-tag']).toBe('noindex')
      expect(html).toContain(expectedTitle)
      expect(html).toContain(`<meta property="og:title" content="${expectedOgTitle}"`)
      expect(html).toMatch(/<meta property="og:image" content="[^"]+\/_og\//)
      expect(html).not.toContain('__NUXT_DATA__')
      expect(html).not.toContain('<footer')
    })
  }

  test('loads releases client-side on /package-changelog/nuxt', async ({ page, goto }) => {
    await page.route('**/api/changelog/info/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASE_INFO),
      }),
    )
    await page.route('**/api/changelog/releases/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASES),
      }),
    )

    await goto('/package-changelog/nuxt', { waitUntil: 'hydration' })

    await expect(page.locator('h1')).toContainText('nuxt')
    await expect(page.getByText('Bug fixes and performance improvements.')).toBeVisible()
  })

  test('loads via /changelog alias', async ({ page, goto }) => {
    await page.route('**/api/changelog/info/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASE_INFO),
      }),
    )
    await page.route('**/api/changelog/releases/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASES),
      }),
    )

    await goto('/changelog/nuxt/v/4.3.1', { waitUntil: 'hydration' })

    await expect(page.locator('h1')).toContainText('nuxt')
    await expect(page.getByText('Bug fixes and performance improvements.')).toBeVisible()
  })

  test('shows loading skeleton then content while changelog info is pending', async ({
    page,
    goto,
  }) => {
    let resolveInfo!: () => void
    const infoGate = new Promise<void>(resolve => {
      resolveInfo = resolve
    })

    await page.route('**/api/changelog/info/**', async route => {
      await infoGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASE_INFO),
      })
    })
    await page.route('**/api/changelog/releases/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASES),
      }),
    )

    await goto('/package-changelog/nuxt', { waitUntil: 'hydration' })

    await expect(page.locator('.animate-skeleton-pulse').first()).toBeVisible()
    await expect(page.getByText(/does not publish changelogs/i)).toHaveCount(0)

    resolveInfo()
    await expect(page.getByText('Bug fixes and performance improvements.')).toBeVisible()
  })

  test('renders error state when release fetch fails', async ({ page, goto }) => {
    await page.route('**/api/changelog/info/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASE_INFO),
      }),
    )
    await page.route('**/api/changelog/releases/**', route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Upstream error' }),
      }),
    )

    await goto('/package-changelog/nuxt', { waitUntil: 'hydration' })

    await expect(page.getByText(/changelog for nuxt couldn't be loaded/i)).toBeVisible()
  })

  for (const fails of [false, true]) {
    test(`loads markdown changelog client-side (${fails ? 'error' : 'success'})`, async ({
      page,
      goto,
    }) => {
      let resolveMarkdown!: () => void
      const markdownGate = new Promise<void>(resolve => {
        resolveMarkdown = resolve
      })

      await page.route('**/api/changelog/info/**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            type: 'md',
            provider: 'github',
            repo: 'nuxt/nuxt',
            path: 'CHANGELOG.md',
            link: 'https://github.com/nuxt/nuxt/blob/main/CHANGELOG.md',
          }),
        }),
      )
      await page.route('**/api/changelog/md/**', async route => {
        await markdownGate
        await route.fulfill({
          status: fails ? 500 : 200,
          contentType: 'application/json',
          body: JSON.stringify(
            fails
              ? { message: 'Markdown unavailable' }
              : { html: '<h2 id="markdown-release">Markdown release notes</h2>', toc: [] },
          ),
        })
      })

      await goto('/package-changelog/nuxt', { waitUntil: 'hydration' })

      const content = page.locator('main > section')
      await expect(content.locator('.animate-skeleton-pulse').first()).toBeVisible()
      await expect(page.getByText('Markdown release notes')).toHaveCount(0)

      resolveMarkdown()
      if (fails) {
        await expect(page.getByText(/changelog for nuxt couldn't be loaded/i)).toBeVisible()
      } else {
        await expect(page.getByRole('heading', { name: 'Markdown release notes' })).toBeVisible()
      }
      await expect(content.locator('.animate-skeleton-pulse')).toHaveCount(0)
    })
  }

  test('renders not-found state for a missing package', async ({ page, goto }) => {
    const path = '/package-changelog/nonexistent-pkg-for-test'
    const response = await page.request.get(path)
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('data-ssr="false"')

    await page.route('https://npm.antfu.dev/nonexistent-pkg-for-test**', route =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: true, statusCode: 404, message: 'Not Found' }),
      }),
    )

    const resolutionRequest = page.waitForRequest(request =>
      request.url().startsWith('https://npm.antfu.dev/nonexistent-pkg-for-test'),
    )
    await goto(path, { waitUntil: 'hydration' })
    await resolutionRequest

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.locator('h1')).toContainText(/not found/i)
  })

  test('does not shift layout when releases load after the skeleton', async ({ page, goto }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.addInitScript(() => {
      ;(window as unknown as { clsValue: number }).clsValue = 0
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as Array<
          PerformanceEntry & { value: number; hadRecentInput: boolean }
        >) {
          if (!entry.hadRecentInput) {
            ;(window as unknown as { clsValue: number }).clsValue += entry.value
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })

    await page.route('**/api/changelog/info/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 150))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASE_INFO),
      })
    })
    await page.route('**/api/changelog/releases/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 150))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_RELEASES),
      })
    })

    await goto('/package-changelog/nuxt', { waitUntil: 'hydration' })
    await expect(page.getByText('Bug fixes and performance improvements.')).toBeVisible()
    await page.waitForLoadState('networkidle')
    const cls = await page.evaluate(
      () =>
        new Promise<number>(resolve =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              setTimeout(resolve, 500, (window as unknown as { clsValue: number }).clsValue),
            ),
          ),
        ),
    )

    expect(cls).toBe(0)
  })
})
