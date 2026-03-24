import { describe, expect, it } from 'vitest'

type RequestedVersion = Exclude<SlimPackument['requestedVersion'], null>

function mockPackage(repository: RequestedVersion['repository']): RequestedVersion {
  return {
    _id: 'foo',
    name: 'foo',
    dist: { shasum: 'foo', signatures: [], tarball: '' },
    _npmVersion: '',
    version: '0.1.0',
    repository,
  }
}

describe('useRepositoryUrl', () => {
  it('should strip .git from repository URL', () => {
    const { repositoryUrl } = useRepositoryUrl(
      mockPackage({
        type: 'git',
        url: 'git+https://github.com/agentmarkup/agentmarkup.git',
      }),
    )

    expect(repositoryUrl.value).toBe('https://github.com/agentmarkup/agentmarkup')
  })

  it('should append /tree/HEAD/{directory} for monorepo packages without .git', () => {
    const { repositoryUrl } = useRepositoryUrl(
      mockPackage({
        type: 'git',
        url: 'git+https://github.com/agentmarkup/agentmarkup.git',
        directory: 'packages/vite',
      }),
    )

    expect(repositoryUrl.value).toBe(
      'https://github.com/agentmarkup/agentmarkup/tree/HEAD/packages/vite',
    )
  })

  it('should return null when repository has no url', () => {
    // @ts-expect-error tests
    const { repositoryUrl } = useRepositoryUrl(mockPackage({}))
    expect(repositoryUrl.value).toBeNull()
  })

  it('should return null when no repository field', () => {
    // @ts-expect-error tests
    const { repositoryUrl } = useRepositoryUrl(mockPackage())
    expect(repositoryUrl.value).toBeNull()
  })

  it('should handle plain HTTPS URLs without .git suffix', () => {
    const { repositoryUrl } = useRepositoryUrl(mockPackage({ url: 'https://github.com/nuxt/ui' }))
    expect(repositoryUrl.value).toBe('https://github.com/nuxt/ui')
  })

  it('should handle directory with trailing slash', () => {
    const { repositoryUrl } = useRepositoryUrl(
      mockPackage({
        url: 'git+https://github.com/org/repo.git',
        directory: 'packages/core/',
      }),
    )

    expect(repositoryUrl.value).toBe('https://github.com/org/repo/tree/HEAD/packages/core/')
  })
})
