import { expect, test } from './test-utils'

// TODO(serhalp): The nuxt@3.20.2 fixture has no stars. Update fixture to have stars coverage here.

/**
 * OG image snapshot tests (Takumi templates).
 *
 * Each entry tests a different visual edge case to catch layout/overflow regressions:
 * - Home page (Splash.takumi)
 * - Static pages (Page.takumi)
 * - Packages (Package.takumi with download-chart, code-tree, function-tree variants)
 */
const testCases = [
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

  // Package code-tree variant (file tree decoration)
  { path: '/package-code/vue/v/3.5.27', label: 'code-tree variant' },

  // Package function-tree variant (API symbols decoration)
  { path: '/package-docs/ufo/v/1.6.3', label: 'function-tree variant' },
] as const

for (const { path, label } of testCases) {
  test.describe(`${label} (${path})`, () => {
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
