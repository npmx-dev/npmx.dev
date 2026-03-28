import { expect, test } from './test-utils'

test.describe('security headers', () => {
  test('HTML pages include CSP meta tag and security headers', async ({ page, baseURL }) => {
    const response = await page.goto(baseURL!)
    const headers = response!.headers()

    // CSP is delivered via <meta http-equiv> in <head>
    const cspContent = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')
    expect(cspContent).toContain("script-src 'self'")
    expect(cspContent).toContain('https://api.star-history.com')
    expect(cspContent).toContain('https://cdn.bsky.app')
    expect(cspContent).toContain('https://public.api.bsky.app')

    // Other security headers via route rules
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('API routes do not include CSP', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/api/registry/package-meta/vue`)

    expect(response.headers()['content-security-policy']).toBeUndefined()
  })

  // Navigate key pages and assert no CSP violations are logged.
  // This catches new external resources that weren't added to the CSP.
  const PAGES = ['/', '/package/nuxt', '/search?q=vue', '/compare', '/blog/alpha-release'] as const

  for (const path of PAGES) {
    test(`no CSP violations on ${path}`, async ({ goto, cspViolations }) => {
      await goto(path, { waitUntil: 'hydration' })
      expect(cspViolations).toEqual([])
    })
  }
})
