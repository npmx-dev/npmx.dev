import type * as AtprotoLex from '@atproto/lex'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { H3Event } from 'h3'

const callMock = vi.hoisted(() => vi.fn())
const getQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@atproto/lex', async importOriginal => ({
  ...(await importOriginal<typeof AtprotoLex>()),
  Client: class {
    call = callMock
  },
}))

vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
// The route uses Nuxt's auto-imported h3 helpers, which unit tests do not get.
vi.stubGlobal('getQuery', getQueryMock)
vi.stubGlobal(
  'createError',
  vi.fn((options: unknown) => options),
)

const handler = (await import('#server/api/atproto/bluesky-author-profiles.get')).default
const fakeEvent = {} as H3Event

function authorsWithHandles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Author ${i}`,
    blueskyHandle: `author-${i}.bsky.social`,
  }))
}

function profilesFor(actors: string[]) {
  return { profiles: actors.map(handle => ({ handle, avatar: `https://cdn.test/${handle}` })) }
}

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('bluesky author profiles API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Like the real API, reject the whole request above 25 actors
    callMock.mockImplementation(async (_method: unknown, { actors }: { actors: string[] }) => {
      if (actors.length > 25) throw new Error(`array too big (maximum 25, got ${actors.length})`)
      return profilesFor(actors)
    })
  })

  it('fetches more than 25 authors in batches and resolves every avatar', async () => {
    const authors = authorsWithHandles(27)
    getQueryMock.mockReturnValue({ authors: JSON.stringify(authors) })

    const { authors: resolved } = await handler(fakeEvent)

    expect(callMock.mock.calls.map(([, { actors }]) => actors.length)).toEqual([25, 2])
    expect(resolved.map(author => author.avatar)).toEqual(
      authors.map(author => `https://cdn.test/${author.blueskyHandle}`),
    )
  })

  it('requests a handle only once when several articles share an author', async () => {
    const authors = [
      ...authorsWithHandles(25),
      { name: 'Again', blueskyHandle: 'author-0.bsky.social' },
    ]
    getQueryMock.mockReturnValue({ authors: JSON.stringify(authors) })

    const { authors: resolved } = await handler(fakeEvent)

    expect(callMock).toHaveBeenCalledOnce()
    expect(resolved.at(-1)?.avatar).toBe('https://cdn.test/author-0.bsky.social')
  })

  it('keeps the avatars of other batches when one batch fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    callMock.mockRejectedValueOnce(new Error('upstream error'))
    getQueryMock.mockReturnValue({ authors: JSON.stringify(authorsWithHandles(27)) })

    const { authors: resolved } = await handler(fakeEvent)

    expect(resolved.filter(author => author.avatar).length).toBe(2)
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
