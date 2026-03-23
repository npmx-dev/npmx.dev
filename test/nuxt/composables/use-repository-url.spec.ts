import { describe, expect, it } from 'vitest'

/**
 * Tests for useRepositoryUrl composable.
 *
 * Regression tests for GitHub issue #2233: monorepo packages with .git suffix
 * in repository.url generated broken source links like:
 * https://github.com/org/repo.git/tree/HEAD/packages/foo (404)
 * instead of:
 * https://github.com/org/repo/tree/HEAD/packages/foo
 */
describe('useRepositoryUrl', () => {
  it('should strip .git from repository URL', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({
      repository: {
        type: 'git',
        url: 'git+https://github.com/agentmarkup/agentmarkup.git',
      },
    }))

    expect(repositoryUrl.value).toBe('https://github.com/agentmarkup/agentmarkup')
  })

  it('should append /tree/HEAD/{directory} for monorepo packages without .git', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({
      repository: {
        type: 'git',
        url: 'git+https://github.com/agentmarkup/agentmarkup.git',
        directory: 'packages/vite',
      },
    }))

    expect(repositoryUrl.value).toBe(
      'https://github.com/agentmarkup/agentmarkup/tree/HEAD/packages/vite',
    )
  })

  it('should return null when repository has no url', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({
      repository: {},
    }))

    expect(repositoryUrl.value).toBeNull()
  })

  it('should return null when no repository field', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({}))

    expect(repositoryUrl.value).toBeNull()
  })

  it('should handle plain HTTPS URLs without .git suffix', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({
      repository: {
        url: 'https://github.com/nuxt/ui',
      },
    }))

    expect(repositoryUrl.value).toBe('https://github.com/nuxt/ui')
  })

  it('should handle directory with trailing slash', () => {
    const { repositoryUrl } = useRepositoryUrl(ref({
      repository: {
        url: 'git+https://github.com/org/repo.git',
        directory: 'packages/core/',
      },
    }))

    expect(repositoryUrl.value).toBe(
      'https://github.com/org/repo/tree/HEAD/packages/core/',
    )
  })
})
