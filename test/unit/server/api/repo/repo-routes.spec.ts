import { afterAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { H3Event } from 'h3'

const createForgeProviderMock = vi.hoisted(() => vi.fn())
const getRouterParamMock = vi.hoisted(() => vi.fn())
const getQueryMock = vi.hoisted(() => vi.fn())

vi.mock('h3', () => ({
  createError: vi.fn((options: unknown) => options),
  getRouterParam: getRouterParamMock,
  getQuery: getQueryMock,
}))

vi.mock('#shared/utils/forges', () => ({
  createForgeProvider: createForgeProviderMock,
  toForgeRepoRef: (ref: unknown) => ref,
}))

vi.stubGlobal('defineCachedEventHandler', (fn: Function) => fn)
// The routes use Nuxt's auto-imported h3 helpers, which unit tests do not get.
vi.stubGlobal('getRouterParam', getRouterParamMock)
vi.stubGlobal('getQuery', getQueryMock)
vi.stubGlobal(
  'createError',
  vi.fn((options: unknown) => options),
)

const issuesHandler = (await import('#server/api/repo/[provider]/[owner]/[repo]/issues.get'))
  .default
const { repoCacheKey } = await import('#server/utils/repo-route')

const fakeEvent = {} as H3Event

afterAll(() => {
  vi.unstubAllGlobals()
})

function params({
  provider = 'gitlab',
  owner = 'owner',
  repo = 'repo',
}: {
  provider?: string
  owner?: string
  repo?: string
} = {}) {
  getRouterParamMock.mockImplementation((_event: unknown, name: string) => {
    if (name === 'provider') return provider
    if (name === 'owner') return owner
    if (name === 'repo') return repo
    return undefined
  })
}

describe.each([['issues', () => issuesHandler]])('%s route', (_name, getHandler) => {
  beforeEach(() => {
    vi.clearAllMocks()
    params()
    getQueryMock.mockReturnValue({ host: 'gitlab.com' })
  })

  it('rejects an unknown provider before creating a forge client', async () => {
    params({ provider: 'not-a-forge' })

    await expect(getHandler()(fakeEvent)).rejects.toEqual({
      statusCode: 400,
      statusMessage: 'Unknown git provider.',
    })
    expect(createForgeProviderMock).not.toHaveBeenCalled()
  })

  it('rejects a host that is not allowlisted for the provider', async () => {
    getQueryMock.mockReturnValue({ host: 'evil.test' })

    await expect(getHandler()(fakeEvent)).rejects.toEqual({
      statusCode: 400,
      statusMessage: 'Invalid repository host.',
    })
    expect(createForgeProviderMock).not.toHaveBeenCalled()
  })
})

describe('issues route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params({ provider: 'github' })
    getQueryMock.mockReturnValue({})
  })

  it('returns a null count when the forge cannot search issues', async () => {
    createForgeProviderMock.mockResolvedValue({ can: () => false })

    await expect(issuesHandler(fakeEvent)).resolves.toEqual({
      owner: 'owner',
      repo: 'repo',
      issues: null,
    })
  })

  it('returns a null count when the forge has no client', async () => {
    createForgeProviderMock.mockResolvedValue(undefined)

    await expect(issuesHandler(fakeEvent)).resolves.toEqual({
      owner: 'owner',
      repo: 'repo',
      issues: null,
    })
  })

  it('reads the open issue total through search', async () => {
    const page = vi.fn().mockResolvedValue({ total: 12 })
    const threads = vi.fn(() => ({ page }))
    createForgeProviderMock.mockResolvedValue({ can: () => true, search: { threads } })

    await expect(issuesHandler(fakeEvent)).resolves.toEqual({
      owner: 'owner',
      repo: 'repo',
      issues: 12,
    })
    expect(threads).toHaveBeenCalledWith({
      repo: { provider: 'github', owner: 'owner', repo: 'repo' },
      kind: 'issue',
      state: 'open',
      perPage: 1,
    })
  })
})

describe('repo cache keys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    params({ provider: 'gitlab', owner: 'group/sub', repo: 'project' })
  })

  it('includes the provider and the self-hosted instance', () => {
    getQueryMock.mockReturnValue({ host: 'gitlab.gnome.org' })

    expect(repoCacheKey(fakeEvent)).toBe('gitlab:group/sub/project@gitlab.gnome.org')
  })

  it('includes the provider when there is no host', () => {
    getQueryMock.mockReturnValue({})

    expect(repoCacheKey(fakeEvent)).toBe('gitlab:group/sub/project')
  })
})
