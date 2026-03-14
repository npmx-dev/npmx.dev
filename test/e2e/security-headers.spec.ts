import { expect, test } from './test-utils'

test.describe('security headers', () => {
  test('HTML pages include CSP and security headers', async ({ page, baseURL }) => {
    const response = await page.goto(baseURL!)
    const headers = response!.headers()

    expect(headers['content-security-policy']).toBeDefined()
    expect(headers['content-security-policy']).toContain("script-src 'self'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
  })

  test('API routes do not include CSP headers', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/api/registry/package-meta/vue`)
    const headers = response.headers()

    expect(headers['content-security-policy']).toBeFalsy()
  })
})
