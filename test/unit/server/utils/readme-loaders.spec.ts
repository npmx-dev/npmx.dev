import { describe, expect, it, vi, beforeEach } from 'vitest'
import { parsePackageParams } from '../../../../server/utils/parse-package-params'
import { NPM_MISSING_README_SENTINEL } from '#shared/utils/constants'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)
vi.stubGlobal('parsePackageParams', parsePackageParams)

const fetchNpmPackageMock = vi.fn()
vi.stubGlobal('fetchNpmPackage', fetchNpmPackageMock)

const parseRepositoryInfoMock = vi.fn()
vi.stubGlobal('parseRepositoryInfo', parseRepositoryInfoMock)

const { fetchReadmeFromJsdelivr, isStandardReadme, resolvePackageReadmeSource } =
  await import('../../../../server/utils/readme-loaders')

describe('isStandardReadme', () => {
  it('returns true for standard README filenames', () => {
    expect(isStandardReadme('README.md')).toBe(true)
    expect(isStandardReadme('readme.md')).toBe(true)
    expect(isStandardReadme('Readme.md')).toBe(true)
    expect(isStandardReadme('README')).toBe(true)
    expect(isStandardReadme('readme')).toBe(true)
    expect(isStandardReadme('README.markdown')).toBe(true)
    expect(isStandardReadme('readme.markdown')).toBe(true)
  })

  it('returns false for non-standard filenames', () => {
    expect(isStandardReadme('CONTRIBUTING.md')).toBe(false)
    expect(isStandardReadme('README.txt')).toBe(false)
    expect(isStandardReadme('readme.rst')).toBe(false)
    expect(isStandardReadme(undefined)).toBe(false)
    expect(isStandardReadme('')).toBe(false)
  })
})

describe('fetchReadmeFromJsdelivr', () => {
  it('returns content when first filename succeeds', async () => {
    const content = '# Package'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => content,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchReadmeFromJsdelivr('some-pkg', ['README.md'])

    expect(result).toBe(content)
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/some-pkg/README.md')
  })

  it('includes version in URL when version is passed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchReadmeFromJsdelivr('pkg', ['README.md'], '1.2.3')

    expect(fetchMock).toHaveBeenCalledWith('https://cdn.jsdelivr.net/npm/pkg@1.2.3/README.md')
  })

  it('returns null when all fetches fail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchReadmeFromJsdelivr('pkg', ['README.md', 'readme.md'])

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('resolvePackageReadmeSource', () => {
  beforeEach(() => {
    fetchNpmPackageMock.mockReset()
    parseRepositoryInfoMock.mockReset()
  })

  it('prefers jsDelivr readme over packument readme (latest)', async () => {
    const jsdelivrContent = '# Full README from CDN'
    fetchNpmPackageMock.mockResolvedValue({
      'readme': '# Truncated',
      'readmeFilename': 'README.md',
      'repository': { url: 'https://github.com/u/r' },
      'versions': {},
      'dist-tags': { latest: '2.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue({
      provider: 'github',
      owner: 'u',
      repo: 'r',
      rawBaseUrl: 'https://raw.githubusercontent.com/u/r/HEAD',
      blobBaseUrl: 'https://github.com/u/r/blob/HEAD',
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => jsdelivrContent,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('some-pkg')

    expect(result).toMatchObject({
      packageName: 'some-pkg',
      version: undefined,
      markdown: jsdelivrContent,
      repoInfo: { provider: 'github', owner: 'u', repo: 'r' },
    })
    expect(fetchNpmPackageMock).toHaveBeenCalledWith('some-pkg')
  })

  it('uses resolved latest version for jsDelivr when no version specified', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      'readme': '# Packument',
      'readmeFilename': 'README.md',
      'repository': undefined,
      'versions': {},
      'dist-tags': { latest: '3.1.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# CDN',
    })
    vi.stubGlobal('fetch', fetchMock)

    await resolvePackageReadmeSource('pkg')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('pkg@3.1.0'))
  })

  it('returns markdown from specific version jsDelivr when packagePath includes version', async () => {
    const jsdelivrContent = '# Version readme from CDN'
    fetchNpmPackageMock.mockResolvedValue({
      'readme': 'latest readme',
      'readmeFilename': 'README.md',
      'repository': undefined,
      'versions': {
        '1.0.0': { readme: 'version readme from packument', readmeFilename: 'README.md' },
      },
      'dist-tags': { latest: '2.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => jsdelivrContent,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('some-pkg/v/1.0.0')

    expect(result).toMatchObject({
      packageName: 'some-pkg',
      version: '1.0.0',
      markdown: jsdelivrContent,
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('some-pkg@1.0.0'))
  })

  it('falls back to packument readme when jsDelivr fails', async () => {
    const packumentReadme = '# From packument'
    fetchNpmPackageMock.mockResolvedValue({
      'readme': packumentReadme,
      'readmeFilename': 'README.md',
      'repository': undefined,
      'versions': {},
      'dist-tags': { latest: '1.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({
      packageName: 'pkg',
      markdown: packumentReadme,
    })
  })

  it('falls back to version packument readme when jsDelivr fails', async () => {
    const versionReadme = '# Version readme'
    fetchNpmPackageMock.mockResolvedValue({
      'readme': 'latest readme',
      'repository': undefined,
      'versions': {
        '1.0.0': { readme: versionReadme },
      },
      'dist-tags': { latest: '1.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg/v/1.0.0')

    expect(result).toMatchObject({
      packageName: 'pkg',
      version: '1.0.0',
      markdown: versionReadme,
    })
  })

  it('skips packument readme with missing sentinel in fallback', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      'readme': NPM_MISSING_README_SENTINEL,
      'readmeFilename': 'README.md',
      'repository': undefined,
      'versions': {},
      'dist-tags': { latest: '1.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({
      packageName: 'pkg',
      markdown: undefined,
      repoInfo: undefined,
    })
  })

  it('returns undefined markdown when no content anywhere', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      'readme': undefined,
      'readmeFilename': undefined,
      'repository': undefined,
      'versions': {},
      'dist-tags': { latest: '1.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({
      packageName: 'pkg',
      version: undefined,
      markdown: undefined,
      repoInfo: undefined,
    })
  })

  it('uses package repository for repoInfo when markdown is present', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      'readme': '# Hi',
      'readmeFilename': 'README.md',
      'repository': { url: 'https://github.com/a/b' },
      'versions': {},
      'dist-tags': { latest: '1.0.0' },
    })
    const repoInfo = {
      provider: 'github' as const,
      owner: 'a',
      repo: 'b',
      rawBaseUrl: 'https://raw.githubusercontent.com/a/b/HEAD',
      blobBaseUrl: 'https://github.com/a/b/blob/HEAD',
    }
    parseRepositoryInfoMock.mockReturnValue(repoInfo)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# CDN',
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result?.repoInfo).toEqual(repoInfo)
    expect(parseRepositoryInfoMock).toHaveBeenCalledWith({ url: 'https://github.com/a/b' })
  })
})
