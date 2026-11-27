import type { H3Event } from 'h3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { parsePackageParams } from '#server/utils/parse-package-params'

const setResponseHeaderMock = vi.hoisted(() => vi.fn())
const getCookieMock = vi.hoisted(() => vi.fn())
const getHeaderMock = vi.hoisted(() => vi.fn())
const setCookieMock = vi.hoisted(() => vi.fn())
const deleteCookieMock = vi.hoisted(() => vi.fn())
const useSessionMock = vi.hoisted(() => vi.fn())

const getTotalLikesMock = vi.hoisted(() => vi.fn())
const getLikesMock = vi.hoisted(() => vi.fn())
const getTopLikedRankMock = vi.hoisted(() => vi.fn())

let routerParam: string | undefined

vi.mock('h3', () => ({
  setResponseHeader: setResponseHeaderMock,
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

vi.mock('#server/utils/likes-leaderboard', () => ({
  getTopLikedRank: getTopLikedRankMock,
}))

vi.stubGlobal('defineEventHandler', (fn: Function) => fn)
vi.stubGlobal('getRouterParam', () => routerParam)
vi.stubGlobal('parsePackageParams', parsePackageParams)
vi.stubGlobal('useRuntimeConfig', () => ({
  sessionPassword: 'test-session-password-32-chars-long',
}))
vi.stubGlobal(
  'createError',
  (options: { status?: number; statusCode?: number; message?: string }) =>
    Object.assign(new Error(options.message ?? 'error'), options),
)
vi.stubGlobal(
  'handleApiError',
  (error: unknown, fallback: { statusCode: number; message: string }) => {
    if (error && typeof error === 'object' && ('status' in error || 'statusCode' in error)) {
      throw error
    }
    throw Object.assign(new Error(fallback.message), fallback)
  },
)
vi.stubGlobal(
  'PackageLikesUtils',
  class {
    getTotalLikes = getTotalLikesMock
    getLikes = getLikesMock
  },
)

const { eventHandlerWithOAuthSession } = await import('#server/utils/atproto/oauth')
vi.stubGlobal('eventHandlerWithOAuthSession', eventHandlerWithOAuthSession)

const publicLikesHandler = (await import('#server/api/social/likes/[...pkg].get')).default
const likeStatusHandler = (await import('#server/api/social/like-status/[...pkg].get')).default

function createEvent(cookies: Record<string, string> = {}, did?: string) {
  getCookieMock.mockImplementation((_event: unknown, name: string) => cookies[name])
  getHeaderMock.mockReturnValue(undefined)
  return {
    context: {
      oauthClient: {
        restore: vi.fn(async () => (did ? { did } : undefined)),
      },
    },
  } as unknown as H3Event
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('GET /api/social/likes/[...pkg]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
    getTotalLikesMock.mockResolvedValue(42)
    getTopLikedRankMock.mockResolvedValue(3)
  })

  it('returns only public fields and sets CDN cache headers without reading cookies', async () => {
    routerParam = 'vue'
    const event = createEvent({ h3: 'sealed-session' })

    const result = await publicLikesHandler(event)

    expect(result).toEqual({
      totalLikes: 42,
      topLikedRank: 3,
    })
    expect('userHasLiked' in result).toBe(false)
    expect(getTotalLikesMock).toHaveBeenCalledWith('vue')
    expect(getLikesMock).not.toHaveBeenCalled()
    expect(getCookieMock).not.toHaveBeenCalled()
    expect(useSessionMock).not.toHaveBeenCalled()
    expect(setCookieMock).not.toHaveBeenCalled()
    expect(setResponseHeaderMock).toHaveBeenCalledTimes(1)
    expect(setResponseHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    )
  })

  it('handles scoped package names', async () => {
    routerParam = '@nuxt/ui'
    const event = createEvent()

    const result = await publicLikesHandler(event)

    expect(getTotalLikesMock).toHaveBeenCalledWith('@nuxt/ui')
    expect(result).toEqual({ totalLikes: 42, topLikedRank: 3 })
  })

  it('throws 400 and does not set cache headers when package name is missing', async () => {
    routerParam = undefined
    const event = createEvent()

    await expect(publicLikesHandler(event)).rejects.toMatchObject({ status: 400 })
    expect(setResponseHeaderMock).not.toHaveBeenCalled()
  })

  it('does not set cache headers when upstream fails', async () => {
    routerParam = 'vue'
    getTotalLikesMock.mockRejectedValueOnce(new Error('constellation down'))
    const event = createEvent()

    await expect(publicLikesHandler(event)).rejects.toMatchObject({ statusCode: 502 })
    expect(setResponseHeaderMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/social/like-status/[...pkg]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerParam = undefined
    getLikesMock.mockResolvedValue({
      totalLikes: 43,
      userHasLiked: true,
      topLikedRank: null,
    })
  })

  it('sets private no-store and returns userHasLiked false without session', async () => {
    routerParam = 'vue'
    const event = createEvent()

    const result = await likeStatusHandler(event)

    expect(result).toEqual({ userHasLiked: false })
    expect(getLikesMock).not.toHaveBeenCalled()
    expect(useSessionMock).not.toHaveBeenCalled()
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store')
  })

  it('returns userHasLiked and fresh totalLikes for an authenticated user', async () => {
    routerParam = '@nuxt/ui'
    const did = 'did:plc:alice123'
    const event = createEvent({ h3: 'sealed-session' }, did)
    useSessionMock.mockResolvedValue({
      data: { public: { did, handle: 'alice.bsky.social', pds: 'https://bsky.social' } },
      clear: vi.fn(),
    })

    const result = await likeStatusHandler(event)

    expect(getLikesMock).toHaveBeenCalledWith('@nuxt/ui', did)
    expect(result).toEqual({
      userHasLiked: true,
      totalLikes: 43,
    })
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store')
  })

  it('throws 400 when package name is missing', async () => {
    routerParam = undefined
    const event = createEvent()

    await expect(likeStatusHandler(event)).rejects.toMatchObject({ status: 400 })
    expect(setResponseHeaderMock).toHaveBeenCalledWith(event, 'Cache-Control', 'private, no-store')
  })
})
