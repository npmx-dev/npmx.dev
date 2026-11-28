import type { APIRequestContext } from '@playwright/test'
import { expect, test } from './test-utils'

// TODO(serhalp): The nuxt@3.20.2 fixture has no stars. Update fixture to have stars coverage here.

/**
 * OG image snapshot tests (Takumi templates).
 *
 * Each entry tests a different visual edge case to catch layout/overflow regressions:
 * - Home page (Splash.takumi)
 * - Static pages (Page.takumi)
 * - Packages (Package.takumi with the download-chart variant, also on code, docs and changelog pages)
 */
const TEST_CASES = [
  // Default OG image template
  { path: '/', label: 'home page' },

  // Page OG image template
  { path: '/accessibility', label: 'page' },

  // Package OG image template — covers key visual edge cases
  { path: '/package/vue', label: 'unscoped package' },
  { path: '/package/nuxt/v/4.3.1', label: 'unscoped with explicit version' },
  { path: '/package/@nuxt/kit', label: 'scoped package' },
  { path: '/package/@tanstack/react-query', label: 'scoped with long name' },
  {
    path: '/package/@babel/plugin-transform-exponentiation-operator',
    label: 'extremely long name',
  },

  // Blog post OG image template
  { path: '/blog/alpha-release', label: 'blog post' },

  // Compare OG image template
  { path: '/compare?packages=vue,react,svelte', label: 'compare' },

  // Client-only pages, server-rendered for link preview bots
  {
    path: '/package-code/vue/v/3.5.27',
    label: 'code page',
    userAgent: 'Slackbot-LinkExpanding 1.0',
  },
  {
    path: '/package-docs/ufo/v/1.6.3',
    label: 'docs page',
    userAgent: 'Slackbot-LinkExpanding 1.0',
  },
  {
    path: '/package-changelog/vue/v/3.5.27',
    label: 'changelog page',
    userAgent: 'Slackbot-LinkExpanding 1.0',
  },
] as const

for (const testCase of TEST_CASES) {
  const { path, label } = testCase
  test.describe(`${label} (${path})`, () => {
    if ('userAgent' in testCase) test.use({ userAgent: testCase.userAgent })

    test(`og image snapshot`, async ({ page, goto, baseURL }) => {
      await goto(path, { waitUntil: 'domcontentloaded' })

      const ogImageUrl = await page
        .locator('meta[property="og:image"]')
        .first()
        .getAttribute('content')
      expect(ogImageUrl).toBeTruthy()

      const ogImagePath = new URL(ogImageUrl!).pathname
      const localUrl = baseURL?.endsWith('/')
        ? `${baseURL}${ogImagePath.slice(1)}`
        : `${baseURL}${ogImagePath}`
      const response = await page.request.get(localUrl)

      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain('image/png')

      const imageBuffer = await response.body()
      expect(imageBuffer).toMatchSnapshot({
        name: `og-image-${path.replace(/\//g, '-').replace(/^-/, '') || 'home'}.png`,
        maxDiffPixelRatio: 0.02,
      })
    })
  })
}

async function fetchOgImageUrl(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  const html = await response.text()
  const tag = html.match(/<meta\s[^>]*property="og:image"[^>]*>/)?.[0]
  expect(tag).toBeTruthy()
  const content = tag!.match(/\bcontent="([^"]+)"/)?.[1]
  expect(content).toBeTruthy()
  return content!.replaceAll('&amp;', '&')
}

test.describe('og image caching and url stability', () => {
  for (const path of ['/', '/accessibility', '/blog', '/settings']) {
    test(`${path} emits a prerendered static OG image`, async ({ request }) => {
      const ogUrl = await fetchOgImageUrl(request, path)
      const pathname = new URL(ogUrl).pathname
      expect(pathname).toMatch(/^\/_og\/s\/.+\.png$/)

      const imageResponse = await request.get(pathname)
      expect(imageResponse.status()).toBe(200)
      expect(imageResponse.headers()['content-type']).toContain('image/png')
    })
  }

  test('irrelevant page queries do not vary package or compare OG URLs', async ({ request }) => {
    const pkgCanonical = await fetchOgImageUrl(request, '/package/vue')
    expect(await fetchOgImageUrl(request, '/package/vue?activeTab=readme&utm_source=bsky')).toBe(
      pkgCanonical,
    )

    const cmpCanonical = await fetchOgImageUrl(request, '/compare?packages=vue,react')
    expect(await fetchOgImageUrl(request, '/compare?packages=react,vue&utm_source=bsky')).toBe(
      cmpCanonical,
    )
    expect(await fetchOgImageUrl(request, '/compare?packages=vue,svelte')).not.toBe(cmpCanonical)
  })

  test('disabled resolver OG paths return cheap cacheable 404s', async ({ request }) => {
    for (const resolverPath of ['/_og/r/package/vue', '/_og/r.png']) {
      const resolver = await request.get(resolverPath)
      expect(resolver.status()).toBe(404)
      expect(resolver.headers()['content-type']).toContain('text/plain')
      expect(resolver.headers()['cache-control']).toContain('s-maxage=300')
      expect(await resolver.text()).toBe('Not Found')
    }
  })
})
