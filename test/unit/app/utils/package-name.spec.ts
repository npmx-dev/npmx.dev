import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkPackageExists,
  findSimilarPackages,
  normalizePackageName,
} from '../../../../app/utils/package-name'

describe('normalizePackageName', () => {
  it.each([
    ['esbuild', 'esbuild'],
    ['@scope/package', 'package'],
    ['ESBuild', 'esbuild'],
    ['my.package', 'mypackage'],
    ['my-package', 'mypackage'],
    ['my_package', 'mypackage'],
    ['jslint', 'lint'],
    ['nodefoo', 'foo'],
    ['foojs', 'foo'],
    ['foonode', 'foo'],
    ['foo-js', 'foo'],
    ['foo-node', 'foo'],
    ['@foo/bar', 'bar'],
  ] as const)('"%s" -> "%s"', (input, expected) => {
    expect(normalizePackageName(input)).toBe(expected)
  })
})

describe('checkPackageExists', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when package exists', async () => {
    fetchMock.mockResolvedValue(undefined)

    const result = await checkPackageExists('vue')

    expect(result).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/vue', { method: 'HEAD' })
  })

  it('returns false when package does not exist', async () => {
    fetchMock.mockRejectedValue(new Error('404'))

    const result = await checkPackageExists('nonexistent-package')

    expect(result).toBe(false)
  })

  it('encodes regular package names', async () => {
    fetchMock.mockResolvedValue(undefined)

    await checkPackageExists('some-package')

    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/some-package', {
      method: 'HEAD',
    })
  })

  it('encodes scoped package names correctly', async () => {
    fetchMock.mockResolvedValue(undefined)

    await checkPackageExists('@vue/core')

    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/@vue%2Fcore', {
      method: 'HEAD',
    })
  })
})

describe('findSimilarPackages', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty array on error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const result = await findSimilarPackages('test-package')

    expect(result).toEqual([])
  })

  it('marks exact name matches as exact-match', async () => {
    fetchMock.mockResolvedValue({
      objects: [{ package: { name: 'svelte', description: 'speed.' } }],
    })

    const result = await findSimilarPackages('svelte')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'svelte',
      similarity: 'exact-match',
    })
  })

  it('returns partial matches up to the exact match', async () => {
    fetchMock.mockResolvedValue({
      objects: [
        { package: { name: 'svel-te', description: 'spe-ed' } },
        { package: { name: 'svelte', description: 'speed.' } },
      ],
    })

    const result = await findSimilarPackages('svelte')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      name: 'svelte',
      description: 'speed.',
      similarity: 'exact-match',
    })
    expect(result[1]).toEqual({
      name: 'svel-te',
      description: 'spe-ed',
      similarity: 'very-similar',
    })
  })

  it('marks normalized matches as very-similar', async () => {
    fetchMock.mockResolvedValue({
      objects: [{ package: { name: 'my-pkg', description: 'A package' } }],
    })

    const result = await findSimilarPackages('my_pkg')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'my-pkg',
      similarity: 'very-similar',
    })
  })

  it('excludes non-matching packages', async () => {
    fetchMock.mockResolvedValue({
      objects: [{ package: { name: 'absolute-nonsense' } }],
    })

    const result = await findSimilarPackages('esbuild')

    expect(result).toEqual([])
  })

  it('includes packages within levenshtein distance threshold', async () => {
    fetchMock.mockResolvedValue({
      objects: [{ package: { name: 'sebuild', description: 'a confused esbuild' } }],
    })

    const result = await findSimilarPackages('esbuild')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'sebuild',
      similarity: 'similar',
    })
  })

  it('sorts results by similarity: exact > very-similar > similar', async () => {
    fetchMock.mockResolvedValue({
      objects: [
        { package: { name: 'sebuild' } }, // similar
        { package: { name: 'esbuild' } }, // exact-match
        { package: { name: 'es-build' } }, // very-similar
      ],
    })

    const result = await findSimilarPackages('esbuild')

    expect(result).toEqual([
      { name: 'esbuild', similarity: 'exact-match' },
      { name: 'es-build', similarity: 'very-similar' },
      { name: 'sebuild', similarity: 'similar' },
    ])
  })
})
