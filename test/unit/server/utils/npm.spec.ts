import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Nitro globals before importing the module under test
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)
vi.stubGlobal('encodePackageName', (name: string) => name.replace('/', '%2F'))
vi.stubGlobal('NPM_REGISTRY', 'https://registry.npmjs.org')
vi.stubGlobal('CACHE_MAX_AGE_FIVE_MINUTES', 300)
vi.stubGlobal('CACHE_MAX_AGE_ONE_DAY', 86400)
vi.stubGlobal('fetchLatestVersion', vi.fn())

const { fetchNpmPackageAbbreviated, fetchNpmPackageVersionLibc } = await import('#server/utils/npm')

describe('fetchNpmPackageAbbreviated', () => {
  beforeEach(() => {
    $fetchMock.mockReset()
  })

  it('requests the abbreviated ("install") metadata', async () => {
    const doc = { name: 'pkg', versions: { '1.0.0': { version: '1.0.0' } } }
    $fetchMock.mockResolvedValue(doc)

    const result = await fetchNpmPackageAbbreviated('@scope/pkg')

    expect(result).toBe(doc)
    expect($fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/@scope%2Fpkg',
      expect.objectContaining({
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      }),
    )
  })
})

describe('fetchNpmPackageVersionLibc', () => {
  beforeEach(() => {
    $fetchMock.mockReset()
  })

  it('reads libc from the single-version manifest', async () => {
    $fetchMock.mockResolvedValue({ libc: ['glibc'] })

    const libc = await fetchNpmPackageVersionLibc('@scope/pkg', '1.2.3')

    expect(libc).toEqual(['glibc'])
    expect($fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/@scope%2Fpkg/1.2.3')
  })

  it('returns undefined when the manifest has no libc', async () => {
    $fetchMock.mockResolvedValue({})

    expect(await fetchNpmPackageVersionLibc('pkg', '1.0.0')).toBeUndefined()
  })
})
