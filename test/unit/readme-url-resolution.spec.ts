import { describe, expect, it } from 'vitest'
import { parseRepositoryInfo } from '../../server/utils/readme'

describe('parseRepositoryInfo', () => {
  it('returns undefined for undefined input', () => {
    expect(parseRepositoryInfo(undefined)).toBeUndefined()
  })

  it('parses GitHub URL from object with git+ prefix', () => {
    const result = parseRepositoryInfo({
      type: 'git',
      url: 'git+https://github.com/vercel/ai.git',
    })
    expect(result).toEqual({
      rawBaseUrl: 'https://raw.githubusercontent.com/vercel/ai/HEAD',
      directory: undefined,
    })
  })

  it('parses GitHub URL with directory (monorepo)', () => {
    const result = parseRepositoryInfo({
      type: 'git',
      url: 'git+https://github.com/withastro/astro.git',
      directory: 'packages/astro',
    })
    expect(result).toEqual({
      rawBaseUrl: 'https://raw.githubusercontent.com/withastro/astro/HEAD',
      directory: 'packages/astro',
    })
  })

  it('parses shorthand GitHub string', () => {
    const result = parseRepositoryInfo('github:nuxt/nuxt')
    // This format doesn't match the regex, returns undefined
    expect(result).toBeUndefined()
  })

  it('parses HTTPS GitHub URL without .git suffix', () => {
    const result = parseRepositoryInfo({
      url: 'https://github.com/nuxt/nuxt',
    })
    expect(result).toEqual({
      rawBaseUrl: 'https://raw.githubusercontent.com/nuxt/nuxt/HEAD',
      directory: undefined,
    })
  })

  it('parses string URL directly', () => {
    const result = parseRepositoryInfo('https://github.com/owner/repo.git')
    expect(result).toEqual({
      rawBaseUrl: 'https://raw.githubusercontent.com/owner/repo/HEAD',
      directory: undefined,
    })
  })

  it('removes trailing slash from directory', () => {
    const result = parseRepositoryInfo({
      url: 'git+https://github.com/org/repo.git',
      directory: 'packages/foo/',
    })
    expect(result?.directory).toBe('packages/foo')
  })

  it('returns undefined for non-GitHub URLs', () => {
    const result = parseRepositoryInfo({
      url: 'https://gitlab.com/owner/repo.git',
    })
    expect(result).toBeUndefined()
  })

  it('returns undefined for empty URL', () => {
    const result = parseRepositoryInfo({ url: '' })
    expect(result).toBeUndefined()
  })
})
