import type { H3Event } from 'h3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'

const getCookieMock = vi.hoisted(() => vi.fn())
const getHeaderMock = vi.hoisted(() => vi.fn())
const setCookieMock = vi.hoisted(() => vi.fn())
const deleteCookieMock = vi.hoisted(() => vi.fn())
const useSessionMock = vi.hoisted(() => vi.fn())

vi.mock('h3', () => ({
  getCookie: getCookieMock,
  getHeader: getHeaderMock,
  setCookie: setCookieMock,
  deleteCookie: deleteCookieMock,
  useSession: useSessionMock,
}))

vi.mock('#oauth/config', () => ({
  clientUri: 'https://npmx.dev',
}))

vi.mock('#server/utils/atproto/lock', () => ({
  getOAuthLock: vi.fn(),
}))

vi.mock('#server/utils/atproto/storage', () => ({
  useOAuthStorage: vi.fn(() => ({ stateStore: {}, sessionStore: {} })),
}))

vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('useRuntimeConfig', () => ({
  sessionPassword: 'test-session-password-32-chars-long',
}))
vi.stubGlobal(
  'createError',
  (options: { status?: number; statusCode?: number; message?: string }) =>
    Object.assign(new Error(options.message ?? 'error'), options),
)

const sessionGetHandler = (await import('#server/api/auth/session.get')).default
const sessionDeleteHandler = (await import('#server/api/auth/session.delete')).default

const validPublicUser = {
  did: 'did:plc:alice123',
  handle: 'alice.bsky.social',
  pds: 'https://bsky.social',
}

function createEvent(cookies: Record<string, string> = {}, oauthRestore?: () => Promise<unknown>) {
  getCookieMock.mockImplementation((_event: unknown, name: string) => cookies[name])
  getHeaderMock.mockReturnValue(undefined)
  return {
    context: {
      oauthClient: {
        restore: vi.fn(
          oauthRestore ?? (async () => ({ did: validPublicUser.did, signOut: vi.fn() })),
        ),
      },
    },
  } as unknown as H3Event
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('auth session endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null without decrypting or setting cookies for anonymous requests', async () => {
    const event = createEvent()

    await expect(sessionGetHandler(event)).resolves.toBeNull()
    expect(useSessionMock).not.toHaveBeenCalled()
    expect(setCookieMock).not.toHaveBeenCalled()
    expect(deleteCookieMock).not.toHaveBeenCalled()
  })

  it('clears a forged hint cookie without creating a server session', async () => {
    const event = createEvent({ [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE })

    await expect(sessionGetHandler(event)).resolves.toBeNull()
    expect(useSessionMock).not.toHaveBeenCalled()
    expect(deleteCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
  })

  it('sets the hint cookie when migrating a logged-in session without a hint', async () => {
    const event = createEvent({ h3: 'sealed-session' })
    useSessionMock.mockResolvedValue({
      data: { public: validPublicUser },
      update: vi.fn(),
      clear: vi.fn(),
    })

    await expect(sessionGetHandler(event)).resolves.toEqual(validPublicUser)
    expect(setCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      SESSION_HINT_VALUE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
  })

  it('does not rewrite the hint cookie when already present on a valid session', async () => {
    const event = createEvent({
      h3: 'sealed-session',
      [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE,
    })
    useSessionMock.mockResolvedValue({
      data: { public: validPublicUser },
      update: vi.fn(),
      clear: vi.fn(),
    })

    await expect(sessionGetHandler(event)).resolves.toEqual(validPublicUser)
    expect(setCookieMock).not.toHaveBeenCalled()
  })

  it('clears both server session and hint cookie when server session has no public user', async () => {
    const clear = vi.fn()
    const event = createEvent({
      h3: 'empty-sealed-session',
      [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE,
    })
    useSessionMock.mockResolvedValue({
      data: {},
      update: vi.fn(),
      clear,
    })

    await expect(sessionGetHandler(event)).resolves.toBeNull()
    expect(clear).toHaveBeenCalledTimes(1)
    expect(deleteCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
  })

  it('clears both server session and hint cookie and throws 401 when oauth restore fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const clear = vi.fn()
    const event = createEvent(
      {
        h3: 'stale-sealed-session',
        [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE,
      },
      async () => {
        throw new Error('session expired')
      },
    )
    useSessionMock.mockResolvedValue({
      data: { public: validPublicUser },
      update: vi.fn(),
      clear,
    })

    await expect(sessionGetHandler(event)).rejects.toMatchObject({ status: 401 })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(deleteCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
    consoleErrorSpy.mockRestore()
  })

  it('signs out oauth and clears both cookies on DELETE /api/auth/session', async () => {
    const signOut = vi.fn()
    const clear = vi.fn()
    const event = createEvent(
      {
        h3: 'sealed-session',
        [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE,
      },
      async () => ({ did: validPublicUser.did, signOut }),
    )
    useSessionMock.mockResolvedValue({
      data: { public: validPublicUser },
      update: vi.fn(),
      clear,
    })

    await expect(sessionDeleteHandler(event)).resolves.toBe('Session cleared')
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(deleteCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
  })

  it('clears the hint cookie without decrypting when DELETE is called without h3 cookie', async () => {
    const event = createEvent({ [SESSION_HINT_COOKIE]: SESSION_HINT_VALUE })

    await expect(sessionDeleteHandler(event)).resolves.toBe('Session cleared')
    expect(useSessionMock).not.toHaveBeenCalled()
    expect(deleteCookieMock).toHaveBeenCalledWith(
      event,
      SESSION_HINT_COOKIE,
      expect.objectContaining({ httpOnly: false, path: '/', sameSite: 'lax' }),
    )
  })
})
