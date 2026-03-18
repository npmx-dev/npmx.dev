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

  it('returns markdown and repoInfo when package has valid npm readme (latest)', async () => {
    const markdown = '# Hello'
    fetchNpmPackageMock.mockResolvedValue({
      readme: markdown,
      readmeFilename: 'README.md',
      repository: { url: 'https://github.com/u/r' },
      versions: {},
    })
    parseRepositoryInfoMock.mockReturnValue({
      provider: 'github',
      owner: 'u',
      repo: 'r',
      rawBaseUrl: 'https://raw.githubusercontent.com/u/r/HEAD',
      blobBaseUrl: 'https://github.com/u/r/blob/HEAD',
    })

    const result = await resolvePackageReadmeSource('some-pkg')

    expect(result).toMatchObject({
      packageName: 'some-pkg',
      version: undefined,
      markdown,
      repoInfo: { provider: 'github', owner: 'u', repo: 'r' },
    })
    expect(fetchNpmPackageMock).toHaveBeenCalledWith('some-pkg')
  })

  it('returns markdown from version when packagePath includes version', async () => {
    const markdown = '# Version readme'
    fetchNpmPackageMock.mockResolvedValue({
      readme: 'latest readme',
      readmeFilename: 'README.md',
      repository: undefined,
      versions: {
        '1.0.0': { readme: markdown, readmeFilename: 'README.md' },
      },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)

    const result = await resolvePackageReadmeSource('some-pkg/v/1.0.0')

    expect(result).toMatchObject({
      packageName: 'some-pkg',
      version: '1.0.0',
      markdown,
    })
  })

  it('falls back to jsdelivr when npm readme is missing sentinel', async () => {
    const jsdelivrContent = '# From CDN'
    fetchNpmPackageMock.mockResolvedValue({
      readme: NPM_MISSING_README_SENTINEL,
      readmeFilename: 'README.md',
      repository: undefined,
      versions: {},
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => jsdelivrContent,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({
      packageName: 'pkg',
      markdown: jsdelivrContent,
      repoInfo: undefined,
    })
    expect(fetchMock).toHaveBeenCalled()
  })

  it('falls back to jsdelivr when readmeFilename is not standard', async () => {
    const jsdelivrContent = '# From CDN'
    fetchNpmPackageMock.mockResolvedValue({
      readme: 'content',
      readmeFilename: 'DOCS.md',
      repository: undefined,
      versions: {},
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => jsdelivrContent,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({ markdown: jsdelivrContent })
  })

  it('returns undefined markdown when no content and jsdelivr fails', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      readme: undefined,
      readmeFilename: undefined,
      repository: undefined,
      versions: {},
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

  it('returns undefined markdown when content is NPM_MISSING_README_SENTINEL and jsdelivr fails', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      readme: NPM_MISSING_README_SENTINEL,
      readmeFilename: 'README.md',
      repository: undefined,
      versions: {},
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({
      packageName: 'pkg',
      markdown: undefined,
      repoInfo: undefined,
    })
  })

  it('fetches from jsdelivr when packument readme exceeds truncation threshold', async () => {
    const truncatedReadme = 'x'.repeat(64_000)
    const fullReadme = 'x'.repeat(80_000)
    fetchNpmPackageMock.mockResolvedValue({
      'readme': truncatedReadme,
      'readmeFilename': 'README.md',
      'repository': undefined,
      'versions': {},
      'dist-tags': { latest: '1.0.0' },
    })
    parseRepositoryInfoMock.mockReturnValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fullReadme,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result).toMatchObject({ markdown: fullReadme })
    expect(fetchMock).toHaveBeenCalled()
  })

  it('uses package repository for repoInfo when markdown is present', async () => {
    fetchNpmPackageMock.mockResolvedValue({
      readme: '# Hi',
      readmeFilename: 'README.md',
      repository: { url: 'https://github.com/a/b' },
      versions: {},
    })
    const repoInfo = {
      provider: 'github' as const,
      owner: 'a',
      repo: 'b',
      rawBaseUrl: 'https://raw.githubusercontent.com/a/b/HEAD',
      blobBaseUrl: 'https://github.com/a/b/blob/HEAD',
    }
    parseRepositoryInfoMock.mockReturnValue(repoInfo)

    const result = await resolvePackageReadmeSource('pkg')

    expect(result?.repoInfo).toEqual(repoInfo)
    expect(parseRepositoryInfoMock).toHaveBeenCalledWith({ url: 'https://github.com/a/b' })
  })
})
