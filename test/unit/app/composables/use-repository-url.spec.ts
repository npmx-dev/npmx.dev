import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, toValue } from 'vue'
import type { SlimPackumentVersion } from '#shared/types/npm-registry'
import { useRepositoryUrl } from '~/composables/useRepositoryUrl'

function createVersion(repository?: SlimPackumentVersion['repository']): SlimPackumentVersion {
  return { repository } as SlimPackumentVersion
}

beforeEach(() => {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('toValue', toValue)
  vi.stubGlobal('normalizeGitUrl', (url: string) => url)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRepositoryUrl', () => {
  it('returns null when repository url is missing', () => {
    const { repositoryUrl } = useRepositoryUrl(null)
    expect(repositoryUrl.value).toBeNull()
  })

  it('returns the url as-is when there is no directory', () => {
    const { repositoryUrl } = useRepositoryUrl(
      createVersion({ url: 'https://github.com/nuxt/nuxt' }),
    )
    expect(repositoryUrl.value).toBe('https://github.com/nuxt/nuxt')
  })

  it('encodes @ in scoped package directory', () => {
    const { repositoryUrl } = useRepositoryUrl(
      createVersion({
        url: 'https://github.com/tailwindlabs/tailwindcss',
        directory: 'packages/@tailwindcss-vite',
      }),
    )
    expect(repositoryUrl.value).toBe(
      'https://github.com/tailwindlabs/tailwindcss/tree/HEAD/packages/%40tailwindcss-vite',
    )
  })

  it('does not encode slashes between directory segments', () => {
    const { repositoryUrl } = useRepositoryUrl(
      createVersion({
        url: 'https://github.com/withastro/astro',
        directory: 'packages/astro',
      }),
    )
    expect(repositoryUrl.value).toBe('https://github.com/withastro/astro/tree/HEAD/packages/astro')
  })
})
