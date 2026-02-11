import { describe, expect, it, vi } from 'vitest'

// Mock Nitro globals before importing the module
vi.stubGlobal('defineCachedFunction', (fn: Function) => fn)
const $fetchMock = vi.fn()
vi.stubGlobal('$fetch', $fetchMock)

const { fetchReadmeFromJsdelivr, isStandardReadme } =
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

  it('tries next filename when response is not ok', async () => {
    const content = '# Fallback'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, text: async () => content })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchReadmeFromJsdelivr('pkg', ['README.md', 'readme.md'])

    expect(result).toBe(content)
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
