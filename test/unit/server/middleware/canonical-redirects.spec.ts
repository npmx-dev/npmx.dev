import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

const fetchMock = vi.fn()
const setHeaderMock = vi.fn()
const sendRedirectMock = vi.fn()

vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('setHeader', setHeaderMock)
vi.stubGlobal('sendRedirect', sendRedirectMock)
vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('getRouteRules', () => ({}))

const handler = (await import('#server/middleware/canonical-redirects.global')).default

function makeEvent(path: string): H3Event {
  return { path } as H3Event
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('canonical-redirects middleware (/org/<name> → /~<name>)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not redirect for a real org (/-/org/<name>/user returns {})', async () => {
    fetchMock.mockResolvedValue({})

    await handler(makeEvent('/org/nuxt'))

    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/-/org/nuxt/user', {
      timeout: 5000,
      retry: 0,
    })
    expect(sendRedirectMock).not.toHaveBeenCalled()
  })

  it('redirects with 301 to /~<name> for a user account (/-/org/<name>/user returns non-empty)', async () => {
    fetchMock.mockResolvedValue({ qwerzl: 'owner' })

    await handler(makeEvent('/org/qwerzl'))

    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/-/org/qwerzl/user', {
      timeout: 5000,
      retry: 0,
    })
    expect(setHeaderMock).toHaveBeenCalledWith(
      expect.anything(),
      'cache-control',
      expect.any(String),
    )
    expect(sendRedirectMock).toHaveBeenCalledWith(expect.anything(), '/~qwerzl', 301)
  })

  it('preserves the query string when redirecting a user account', async () => {
    fetchMock.mockResolvedValue({ QWERZL: 'owner' })

    await handler(makeEvent('/org/QWERZL?tab=members'))

    // name is lowercased, matching npmjs.com behavior
    expect(sendRedirectMock).toHaveBeenCalledWith(expect.anything(), '/~qwerzl?tab=members', 301)
  })

  it('does not redirect for a nonexistent name (/-/org/<name>/user 404s), letting the org page 404', async () => {
    fetchMock.mockRejectedValue({ statusCode: 404, message: 'Not found' })

    await expect(handler(makeEvent('/org/nonexistent-org-12345'))).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/-/org/nonexistent-org-12345/user',
      { timeout: 5000, retry: 0 },
    )
    expect(sendRedirectMock).not.toHaveBeenCalled()
  })

  it('fails open when the user check itself errors (network error, 500, ...)', async () => {
    fetchMock.mockRejectedValue(new Error('network failure'))

    await expect(handler(makeEvent('/org/nuxt'))).resolves.toBeUndefined()

    expect(sendRedirectMock).not.toHaveBeenCalled()
  })

  it('fails open on registry timeout (bounded lookup, no retries)', async () => {
    const timeoutError = new Error('Request aborted due to timeout')
    timeoutError.name = 'TimeoutError'
    fetchMock.mockRejectedValue(timeoutError)

    await expect(handler(makeEvent('/org/nuxt'))).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/-/org/nuxt/user',
      expect.objectContaining({ timeout: 5000, retry: 0 }),
    )
    expect(sendRedirectMock).not.toHaveBeenCalled()
  })

  it('does not run the user check for non-/org/ paths', async () => {
    await handler(makeEvent('/package/vue'))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sendRedirectMock).not.toHaveBeenCalled()
  })
})
