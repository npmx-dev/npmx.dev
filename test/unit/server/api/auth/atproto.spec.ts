import type * as AtprotoLex from '@atproto/lex'
import type { H3Event } from 'h3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

const getCookieMock = vi.hoisted(() => vi.fn())
const getQueryMock = vi.hoisted(() => vi.fn())
const setCookieMock = vi.hoisted(() => vi.fn())
const deleteCookieMock = vi.hoisted(() => vi.fn())
const sendRedirectMock = vi.hoisted(() => vi.fn((_event: unknown, location: string) => location))
const useServerSessionMock = vi.hoisted(() => vi.fn())
const setSessionHintCookieMock = vi.hoisted(() => vi.fn())
const xrpcSafeMock = vi.hoisted(() => vi.fn())

vi.mock('h3', () => ({
  createError: vi.fn((options: { status?: number; statusCode?: number; message?: string }) =>
    Object.assign(new Error(options.message ?? 'error'), options),
  ),
  getCookie: getCookieMock,
  getQuery: getQueryMock,
  setCookie: setCookieMock,
  deleteCookie: deleteCookieMock,
  sendRedirect: sendRedirectMock,
}))

vi.mock('#oauth/config', () => ({
  clientUri: 'https://npmx.dev',
}))

vi.mock('#server/utils/server-session', () => ({
  useServerSession: useServerSessionMock,
  setSessionHintCookie: setSessionHintCookieMock,
}))

vi.mock('#server/utils/error-handler', () => ({
  handleApiError: vi.fn((error: unknown) => {
    throw error
  }),
}))

vi.mock('#server/utils/atproto/oauth', () => ({
  scope: 'atproto',
}))

vi.mock('@atproto/lex', async importOriginal => {
  const actual = await importOriginal<typeof AtprotoLex>()
  return {
    ...actual,
    Client: class {
      did = 'did:plc:alice123'
      xrpcSafe = xrpcSafeMock
      get = vi.fn(async () => ({ value: {} }))
      createRecord = vi.fn(async () => ({}))
    },
  }
})

vi.mock('@atproto/oauth-client-node', () => ({
  OAuthCallbackError: class extends Error {
    state?: string
  },
}))

vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('useRuntimeConfig', () => ({
  sessionPassword: 'test-session-password-32-chars-long',
}))

const handler = (await import('#server/api/auth/atproto.get')).default

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('atproto OAuth handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not create a server session or set the hint cookie when initiating login', async () => {
    getQueryMock.mockReturnValue({ handle: 'alice.bsky.social', returnTo: '/package/vue' })
    const event = {
      path: '/api/auth/atproto?handle=alice.bsky.social',
      context: {
        oauthClient: {
          authorize: vi.fn(async () => new URL('https://bsky.social/oauth/authorize')),
        },
      },
    } as unknown as H3Event

    await expect(handler(event)).resolves.toBe('https://bsky.social/oauth/authorize')
    expect(useServerSessionMock).not.toHaveBeenCalled()
    expect(setSessionHintCookieMock).not.toHaveBeenCalled()
  })

  it('sets the hint cookie after updating the server session on callback', async () => {
    const update = vi.fn()
    useServerSessionMock.mockResolvedValue({ update })
    getQueryMock.mockReturnValue({ code: 'abc', state: 'state' })
    getCookieMock.mockReturnValue('1')
    xrpcSafeMock
      .mockResolvedValueOnce({
        success: true,
        body: {
          did: 'did:plc:alice123',
          handle: 'alice.bsky.social',
          pds: 'https://bsky.social',
        },
      })
      .mockResolvedValueOnce({
        success: true,
        body: { value: { displayName: 'Alice' } },
      })

    const event = {
      path: '/api/auth/atproto?code=abc',
      context: {
        oauthClient: {
          callback: vi.fn(async () => ({
            state: JSON.stringify({ data: { redirectPath: '/package/vue' }, id: 'req123' }),
            session: { did: 'did:plc:alice123', signOut: vi.fn() },
          })),
        },
      },
    } as unknown as H3Event

    await expect(handler(event)).resolves.toBe('/package/vue')
    expect(update).toHaveBeenCalledTimes(1)
    expect(setSessionHintCookieMock).toHaveBeenCalledWith(event)
  })

  it('does not set the hint cookie when callback fails', async () => {
    const signOut = vi.fn()
    getQueryMock.mockReturnValue({ code: 'abc', state: 'state' })
    getCookieMock.mockReturnValue(undefined)

    const event = {
      path: '/api/auth/atproto?code=abc',
      context: {
        oauthClient: {
          callback: vi.fn(async () => ({
            state: JSON.stringify({ data: { redirectPath: '/' }, id: 'missing' }),
            session: { did: 'did:plc:alice123', signOut },
          })),
        },
      },
    } as unknown as H3Event

    await expect(handler(event)).rejects.toThrow(/Missing authentication state/)
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(useServerSessionMock).not.toHaveBeenCalled()
    expect(setSessionHintCookieMock).not.toHaveBeenCalled()
  })
})
