import { describe, expect, it } from 'vitest'
import { parseRepositoryInfo } from '#shared/utils/git-providers'

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
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'withastro',
      repo: 'astro',
      rawBaseUrl: 'https://raw.githubusercontent.com/withastro/astro/HEAD',
      directory: 'packages/astro',
    })
  })

  it('parses shorthand GitHub string', () => {
    const result = parseRepositoryInfo('github:nuxt/nuxt')
    // This shorthand format is not supported
    expect(result).toBeUndefined()
  })

  it('parses HTTPS GitHub URL without .git suffix', () => {
    const result = parseRepositoryInfo({
      url: 'https://github.com/nuxt/nuxt',
    })
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'nuxt',
      repo: 'nuxt',
      rawBaseUrl: 'https://raw.githubusercontent.com/nuxt/nuxt/HEAD',
    })
  })

  it('parses string URL directly', () => {
    const result = parseRepositoryInfo('https://github.com/owner/repo.git')
    expect(result).toMatchObject({
      provider: 'github',
      owner: 'owner',
      repo: 'repo',
      rawBaseUrl: 'https://raw.githubusercontent.com/owner/repo/HEAD',
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
        rawBaseUrl: 'https://gitlab.com/owner/repo/-/raw/HEAD',
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
        rawBaseUrl: 'https://tangled.sh/nonbinary.computer/weaver/raw/branch/main',
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
        rawBaseUrl: 'https://tangled.sh/pds.ls/pdsls/raw/branch/main',
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

  describe('Forgejo support', () => {
    it('parses Forgejo URL from forgejo subdomain', () => {
      const result = parseRepositoryInfo({
        url: 'https://forgejo.example.com/owner/repo',
      })
      expect(result).toMatchObject({
        provider: 'forgejo',
        owner: 'owner',
        repo: 'repo',
        host: 'forgejo.example.com',
      })
    })

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

    it('parses Forgejo URL with .git suffix', () => {
      const result = parseRepositoryInfo({
        url: 'git+ssh://git@forgejo.myserver.com/user/project.git',
      })
      expect(result).toMatchObject({
        provider: 'forgejo',
        owner: 'user',
        repo: 'project',
        host: 'forgejo.myserver.com',
      })
    })
  })
})
