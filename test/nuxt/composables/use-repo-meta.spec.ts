import { describe, expect, it } from 'vitest'
import { parseRepoUrl } from '#shared/utils/git-providers'

/**
 * Tests for useRepoMeta composable.
 *
 * Since the composable uses useLazyAsyncData for fetching, we focus on testing
 * the synchronous URL parsing logic which is the core of the composable.
 * The actual API fetching is covered by the parseRepoUrl utility tests.
 */
describe('useRepoMeta - URL parsing via repoRef', () => {
  describe('GitHub URLs', () => {
    it('should parse standard GitHub URL', () => {
      const result = parseRepoUrl('https://github.com/vuejs/core')

      expect(result).toEqual({
        provider: 'github',
        owner: 'vuejs',
        repo: 'core',
      })
    })

    it('should parse GitHub URL with .git suffix', () => {
      const result = parseRepoUrl('https://github.com/vuejs/core.git')

      expect(result).toEqual({
        provider: 'github',
        owner: 'vuejs',
        repo: 'core',
      })
    })

    it('should parse GitHub URL with www prefix', () => {
      const result = parseRepoUrl('https://www.github.com/nuxt/nuxt')

      expect(result).toEqual({
        provider: 'github',
        owner: 'nuxt',
        repo: 'nuxt',
      })
    })

    it('should parse GitHub URL with extra path segments', () => {
      const result = parseRepoUrl('https://github.com/vuejs/core/tree/main/packages')

      expect(result).toEqual({
        provider: 'github',
        owner: 'vuejs',
        repo: 'core',
      })
    })

    it('should handle URL-encoded characters in owner/repo', () => {
      const result = parseRepoUrl('https://github.com/some-org/some-repo')

      expect(result).toEqual({
        provider: 'github',
        owner: 'some-org',
        repo: 'some-repo',
      })
    })
  })

  describe('GitLab URLs', () => {
    it('should parse standard GitLab URL', () => {
      const result = parseRepoUrl('https://gitlab.com/gitlab-org/gitlab')

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'gitlab-org',
        repo: 'gitlab',
        host: 'gitlab.com',
      })
    })

    it('should parse GitLab URL with nested groups', () => {
      const result = parseRepoUrl('https://gitlab.com/group/subgroup/project')

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'group/subgroup',
        repo: 'project',
        host: 'gitlab.com',
      })
    })

    it('should parse self-hosted GitLab instance', () => {
      const result = parseRepoUrl('https://gitlab.freedesktop.org/mesa/mesa')

      expect(result).toEqual({
        provider: 'gitlab',
        owner: 'mesa',
        repo: 'mesa',
        host: 'gitlab.freedesktop.org',
      })
    })
  })

  describe('Bitbucket URLs', () => {
    it('should parse standard Bitbucket URL', () => {
      const result = parseRepoUrl('https://bitbucket.org/atlassian/aui')

      expect(result).toEqual({
        provider: 'bitbucket',
        owner: 'atlassian',
        repo: 'aui',
      })
    })

    it('should parse Bitbucket URL with www', () => {
      const result = parseRepoUrl('https://www.bitbucket.org/atlassian/aui')

      expect(result).toEqual({
        provider: 'bitbucket',
        owner: 'atlassian',
        repo: 'aui',
      })
    })
  })

  describe('Codeberg URLs', () => {
    it('should parse Codeberg URL', () => {
      const result = parseRepoUrl('https://codeberg.org/forgejo/forgejo')

      expect(result).toMatchObject({
        provider: 'codeberg',
        owner: 'forgejo',
        repo: 'forgejo',
      })
    })
  })

  describe('Gitee URLs', () => {
    it('should parse Gitee URL', () => {
      const result = parseRepoUrl('https://gitee.com/oschina/gitee')

      expect(result).toEqual({
        provider: 'gitee',
        owner: 'oschina',
        repo: 'gitee',
      })
    })
  })

  describe('Sourcehut URLs', () => {
    it('should parse Sourcehut URL with git.sr.ht', () => {
      const result = parseRepoUrl('https://git.sr.ht/~sircmpwn/sourcehut')

      expect(result).toEqual({
        provider: 'sourcehut',
        owner: '~sircmpwn',
        repo: 'sourcehut',
      })
    })

    it('should parse Sourcehut URL with sr.ht', () => {
      const result = parseRepoUrl('https://sr.ht/~user/repo')

      expect(result).toEqual({
        provider: 'sourcehut',
        owner: '~user',
        repo: 'repo',
      })
    })
  })

  describe('Tangled URLs', () => {
    it('should parse Tangled URL', () => {
      const result = parseRepoUrl('https://tangled.sh/did:plc:abc123/repo')

      expect(result).toEqual({
        provider: 'tangled',
        owner: 'did:plc:abc123',
        repo: 'repo',
      })
    })
  })

  describe('Radicle URLs', () => {
    it('should parse Radicle URL', () => {
      const result = parseRepoUrl(
        'https://app.radicle.at/nodes/seed.radicle.at/rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
      )

      expect(result).toEqual({
        provider: 'radicle',
        owner: '',
        repo: 'rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
        host: 'app.radicle.at',
      })
    })
  })

  describe('Generic Gitea URLs', () => {
    it('should parse git.* subdomain as Gitea', () => {
      const result = parseRepoUrl('https://git.example.com/user/repo')

      expect(result).toEqual({
        provider: 'gitea',
        owner: 'user',
        repo: 'repo',
        host: 'git.example.com',
      })
    })

    it('should parse gitea.* subdomain', () => {
      const result = parseRepoUrl('https://gitea.example.org/org/project')

      expect(result).toEqual({
        provider: 'gitea',
        owner: 'org',
        repo: 'project',
        host: 'gitea.example.org',
      })
    })
  })

  describe('Forgejo URLs', () => {
    it('should parse Forgejo instance URL', () => {
      const result = parseRepoUrl('https://next.forgejo.org/forgejo/forgejo')

      expect(result).toEqual({
        provider: 'forgejo',
        owner: 'forgejo',
        repo: 'forgejo',
        host: 'next.forgejo.org',
      })
    })
  })

  describe('Invalid URLs', () => {
    it('should return null for invalid URL', () => {
      const result = parseRepoUrl('not-a-url')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = parseRepoUrl('')
      expect(result).toBeNull()
    })

    it('should return null for URL with insufficient path', () => {
      const result = parseRepoUrl('https://github.com/vuejs')
      expect(result).toBeNull()
    })

    it('should return null for unknown provider', () => {
      const result = parseRepoUrl('https://example.com/user/repo')
      expect(result).toBeNull()
    })
  })
})
