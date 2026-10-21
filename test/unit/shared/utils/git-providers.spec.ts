import { describe, expect, it } from 'vitest'
import { normalizeGitUrl, parseRepositoryInfo } from '#shared/utils/git-providers'

describe('normalizeGitUrl', () => {
  it('should return null for empty input', () => {
    expect.soft(normalizeGitUrl('')).toBeNull()
  })

  it('should leave plain HTTPS URLs unchanged', () => {
    expect
      .soft(normalizeGitUrl('https://github.com/user/repo'))
      .toBe('https://github.com/user/repo')
  })

  it('should remove git+ prefix', () => {
    expect
      .soft(normalizeGitUrl('git+https://github.com/user/repo'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git+https://github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git+ssh://git@github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
  })

  it('should remove .git suffix', () => {
    expect
      .soft(normalizeGitUrl('https://github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('https://gitlab.com/user/repo.git'))
      .toBe('https://gitlab.com/user/repo')
    expect
      .soft(normalizeGitUrl('https://bitbucket.org/user/repo.git'))
      .toBe('https://bitbucket.org/user/repo')
    expect
      .soft(normalizeGitUrl('git+https://github.com/user/repo.git#readme'))
      .toBe('https://github.com/user/repo#readme')
    expect
      .soft(normalizeGitUrl('git+https://github.com/user/repo.git?path=packages/core'))
      .toBe('https://github.com/user/repo?path=packages/core')
  })

  it('should convert git:// protocol to https://', () => {
    expect.soft(normalizeGitUrl('git://github.com/user/repo')).toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git://github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
  })

  it('should convert ssh:// protocol to https://', () => {
    expect
      .soft(normalizeGitUrl('ssh://git@github.com/user/repo'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('ssh://git@github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
  })

  it('should convert SSH format to https://', () => {
    expect.soft(normalizeGitUrl('git@github.com:user/repo')).toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git@github.com:user/repo.git'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git@github.com/user/repo:123'))
      .toBe('https://github.com/user/repo:123')
  })

  it('should handle combined permutations', () => {
    expect
      .soft(normalizeGitUrl('git+git://github.com/user/repo.git'))
      .toBe('https://github.com/user/repo')
    expect
      .soft(normalizeGitUrl('git+ssh://git@gitlab.com/user/repo.git'))
      .toBe('https://gitlab.com/user/repo')
  })

  it('should support shorthand git provider URLs', () => {
    expect.soft(normalizeGitUrl('github:user/repo')).toBe('https://github.com/user/repo')
    expect.soft(normalizeGitUrl('gitlab:user/repo')).toBe('https://gitlab.com/user/repo')
    expect.soft(normalizeGitUrl('bitbucket:user/repo')).toBe('https://bitbucket.org/user/repo')
    expect.soft(normalizeGitUrl('codeberg:user/repo')).toBe('https://codeberg.org/user/repo')
    expect.soft(normalizeGitUrl('gitee:user/repo')).toBe('https://gitee.com/user/repo')
    expect.soft(normalizeGitUrl('sourcehut:~user/repo')).toBe('https://git.sr.ht/~user/repo')
    expect.soft(normalizeGitUrl('sourcehut:org/repo')).toBe('https://git.sr.ht/org/repo')
    expect.soft(normalizeGitUrl('gitea:user/repo')).toBe('https://gitea.com/user/repo')
    expect.soft(normalizeGitUrl('tangled:user/repo')).toBe('https://tangled.org/user/repo')
    expect.soft(normalizeGitUrl('forgejo:user/repo')).toBe('https://code.forgejo.org/user/repo')
    expect
      .soft(normalizeGitUrl('github:user/repo.git#readme'))
      .toBe('https://github.com/user/repo#readme')
  })
})

describe('parseRepositoryInfo', () => {
  it('returns undefined for undefined input', () => {
    expect(parseRepositoryInfo(undefined)).toBeUndefined()
  })

  it('parses GitHub URL from object with git+ prefix', () => {
    const result = parseRepositoryInfo({
      type: 'git',
      url: 'git+https://github.com/vercel/ai.git',
    })
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'vercel',
      repo: 'ai',
      directory: undefined,
    })
  })

  it('parses GitHub URL with directory (monorepo)', () => {
    const result = parseRepositoryInfo({
      type: 'git',
      url: 'git+https://github.com/withastro/astro.git',
      directory: 'packages/astro',
    })
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'withastro',
      repo: 'astro',
      directory: 'packages/astro',
    })
  })

  it('parses shorthand GitHub string', () => {
    const result = parseRepositoryInfo('github:nuxt/nuxt')
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'nuxt',
      repo: 'nuxt',
    })
  })

  it('parses GitHub URL from object with shorthand prefix', () => {
    const result = parseRepositoryInfo({
      type: 'git',
      url: 'github:org/repo',
    })
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'org',
      repo: 'repo',
    })
  })

  it('parses HTTPS GitHub URL without .git suffix', () => {
    const result = parseRepositoryInfo({
      url: 'https://github.com/nuxt/nuxt',
    })
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'nuxt',
      repo: 'nuxt',
    })
  })

  it('parses string URL directly', () => {
    const result = parseRepositoryInfo('https://github.com/owner/repo.git')
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'owner',
      repo: 'repo',
    })
  })

  it('removes trailing slash from directory', () => {
    const result = parseRepositoryInfo({
      url: 'git+https://github.com/org/repo.git',
      directory: 'packages/foo/',
    })
    expect(result?.directory).toBe('packages/foo')
  })

  it('returns undefined for empty URL', () => {
    const result = parseRepositoryInfo({ url: '' })
    expect(result).toBeUndefined()
  })

  // Multi-provider tests
  describe('GitLab support', () => {
    it('parses GitLab URL', () => {
      const result = parseRepositoryInfo({
        url: 'https://gitlab.com/owner/repo.git',
      })
      expect(result).toMatchObject({
        provider: 'gitlab',
        owner: 'owner',
        repo: 'repo',
        host: 'gitlab.com',
      })
    })

    it('parses GitLab URL with nested groups', () => {
      const result = parseRepositoryInfo({
        url: 'git+https://gitlab.com/hyper-expanse/open-source/semantic-release-gitlab.git',
      })
      expect(result).toMatchObject({
        provider: 'gitlab',
        owner: 'hyper-expanse/open-source',
        repo: 'semantic-release-gitlab',
        host: 'gitlab.com',
      })
    })

    it('parses self-hosted GitLab (GNOME)', () => {
      const result = parseRepositoryInfo({
        url: 'https://gitlab.gnome.org/ewlsh/packages.gi.ts.git',
      })
      expect(result).toMatchObject({
        provider: 'gitlab',
        host: 'gitlab.gnome.org',
      })
    })
  })

  describe('Codeberg support', () => {
    it('parses Codeberg URL', () => {
      const result = parseRepositoryInfo({
        url: 'https://codeberg.org/jgarber/CashCash',
      })
      expect(result).toMatchObject({
        provider: 'codeberg',
        owner: 'jgarber',
        repo: 'CashCash',
      })
    })
  })

  describe('Bitbucket support', () => {
    it('parses Bitbucket URL', () => {
      const result = parseRepositoryInfo({
        url: 'git+https://bitbucket.org/atlassian/atlassian-frontend-mirror.git',
      })
      expect(result).toMatchObject({
        provider: 'bitbucket',
        owner: 'atlassian',
        repo: 'atlassian-frontend-mirror',
      })
    })
  })

  describe('Gitee support', () => {
    it('parses Gitee URL', () => {
      const result = parseRepositoryInfo({
        url: 'git+https://gitee.com/oschina/mcp-gitee.git',
      })
      expect(result).toMatchObject({
        provider: 'gitee',
        owner: 'oschina',
        repo: 'mcp-gitee',
      })
    })
  })

  describe('Sourcehut support', () => {
    it('parses Sourcehut URL', () => {
      const result = parseRepositoryInfo({
        url: 'https://git.sr.ht/~ayoayco/astro-resume.git',
      })
      expect(result).toMatchObject({
        provider: 'sourcehut',
        owner: '~ayoayco',
        repo: 'astro-resume',
      })
    })
  })

  describe('Tangled support', () => {
    it('parses Tangled URL with tangled.org domain', () => {
      const result = parseRepositoryInfo({
        url: 'https://tangled.org/nonbinary.computer/weaver',
      })
      expect(result).toMatchObject({
        provider: 'tangled',
        owner: 'nonbinary.computer',
        repo: 'weaver',
      })
    })

    it('parses Tangled URL with tangled.sh domain', () => {
      const result = parseRepositoryInfo({
        url: 'https://tangled.sh/pds.ls/pdsls',
      })
      expect(result).toMatchObject({
        provider: 'tangled',
        owner: 'pds.ls',
        repo: 'pdsls',
      })
    })

    it('parses Tangled URL with .git suffix', () => {
      const result = parseRepositoryInfo({
        type: 'git',
        url: 'https://tangled.org/owner/repo.git',
      })
      expect(result).toMatchObject({
        provider: 'tangled',
        owner: 'owner',
        repo: 'repo',
      })
    })

    it('parses Tangled URL with directory (monorepo)', () => {
      const result = parseRepositoryInfo({
        url: 'https://tangled.org/tangled.org/core',
        directory: 'packages/web',
      })
      expect(result).toMatchObject({
        provider: 'tangled',
        owner: 'tangled.org',
        repo: 'core',
        directory: 'packages/web',
      })
    })
  })

  describe('Radicle support', () => {
    it('parses Radicle URL from app.radicle.at', () => {
      const result = parseRepositoryInfo({
        url: 'https://app.radicle.at/nodes/seed.radicle.at/rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
      })
      expect(result).toMatchObject({
        provider: 'radicle',
        owner: '',
        repo: 'rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
        host: 'app.radicle.at',
      })
    })

    it('parses Radicle URL from seed.radicle.at', () => {
      const result = parseRepositoryInfo({
        url: 'https://seed.radicle.at/rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
      })
      expect(result).toMatchObject({
        provider: 'radicle',
        owner: '',
        repo: 'rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT',
        host: 'seed.radicle.at',
      })
    })
  })

  describe('Pushin support', () => {
    it('parses Pushin URL', () => {
      const result = parseRepositoryInfo({
        url: 'https://pushin.eu/tobbe/npmx-pushin-test',
      })
      expect(result).toMatchObject({
        provider: 'pushin',
        owner: 'tobbe',
        repo: 'npmx-pushin-test',
      })
      expect(result?.host).toBeUndefined()
    })

    it('parses Pushin URL from www.pushin.eu', () => {
      const result = parseRepositoryInfo({
        url: 'https://www.pushin.eu/tobbe/npmx-pushin-test',
      })
      expect(result).toMatchObject({
        provider: 'pushin',
        owner: 'tobbe',
        repo: 'npmx-pushin-test',
      })
    })

    it('parses Pushin HTTPS clone URL from git.pushin.eu', () => {
      const result = parseRepositoryInfo({
        url: 'git+https://git.pushin.eu/tobbe/npmx-pushin-test.git',
      })
      expect(result).toMatchObject({
        provider: 'pushin',
        owner: 'tobbe',
        repo: 'npmx-pushin-test',
      })
      expect(result?.host).toBeUndefined()
    })

    it('parses Pushin SSH clone URL from git.pushin.eu', () => {
      const result = parseRepositoryInfo('git@git.pushin.eu:tobbe/npmx-pushin-test.git')
      expect(result).toMatchObject({
        provider: 'pushin',
        owner: 'tobbe',
        repo: 'npmx-pushin-test',
      })
    })
  })

  describe('Forgejo support', () => {
    it('parses Forgejo URL from next.forgejo.org', () => {
      const result = parseRepositoryInfo({
        url: 'https://next.forgejo.org/forgejo/forgejo',
      })
      expect(result).toMatchObject({
        provider: 'forgejo',
        owner: 'forgejo',
        repo: 'forgejo',
        host: 'next.forgejo.org',
      })
    })
  })

  describe('Gitea support', () => {
    it('parses exact allowlisted Gitea hosts', () => {
      const result = parseRepositoryInfo({
        url: 'https://gitea.com/owner/repo',
      })
      expect(result).toMatchObject({
        provider: 'gitea',
        owner: 'owner',
        repo: 'repo',
        host: 'gitea.com',
      })
    })
  })
})
