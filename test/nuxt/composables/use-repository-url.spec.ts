import { describe, expect, it } from 'vitest'

describe('useRepositoryUrl', () => {
  it('should strip .git from repository URL', () => {
    const { repositoryUrl } = useRepositoryUrl(
      ref({
        repository: {
          type: 'git',
          url: 'git+https://github.com/agentmarkup/agentmarkup.git',
        },
      } as any),
    )

    expect(repositoryUrl.value).toBe('https://github.com/agentmarkup/agentmarkup')
  })

  it('should append /tree/HEAD/{directory} for monorepo packages without .git', () => {
    const { repositoryUrl } = useRepositoryUrl(
      ref({
        repository: {
          type: 'git',
          url: 'git+https://github.com/agentmarkup/agentmarkup.git',
          directory: 'packages/vite',
        },
      } as any),
    )

    expect(repositoryUrl.value).toBe(
      'https://github.com/agentmarkup/agentmarkup/tree/HEAD/packages/vite',
    )
  })

  it('should return null when repository has no url', () => {
    const { repositoryUrl } = useRepositoryUrl(
      ref({
        repository: {},
      } as any),
    )

    expect(repositoryUrl.value).toBeNull()
  })

  it('should return null when no repository field', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({} as any))

    expect(repositoryUrl.value).toBeNull()
  })

  it('should handle plain HTTPS URLs without .git suffix', () => {
    const { repositoryUrl } = useRepositoryUrl(
      ref({
        repository: {
          url: 'https://github.com/nuxt/ui',
        },
      } as any),
    )

    expect(repositoryUrl.value).toBe('https://github.com/nuxt/ui')
  })

  it('should handle directory with trailing slash', () => {
    const { repositoryUrl } = useRepositoryUrl(
      ref({
        repository: {
          url: 'git+https://github.com/org/repo.git',
          directory: 'packages/core/',
        },
      } as any),
    )

    expect(repositoryUrl.value).toBe('https://github.com/org/repo/tree/HEAD/packages/core/')
  })
})
