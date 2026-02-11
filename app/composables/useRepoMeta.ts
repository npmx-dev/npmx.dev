import type { ProviderId, RepoRef } from '#shared/utils/git-providers'
import { parseRepoUrl, GITLAB_HOSTS } from '#shared/utils/git-providers'

// TTL for git repo metadata (10 minutes - repo stats don't change frequently)
const REPO_META_TTL = 60 * 10

export interface Release {
  tag: string // Release tag (e.g., "v1.0.0")
  url: string // URL to this specific release
  name?: string // Release name/title (optional)
  publishedAt?: string // ISO8601 date (optional)
}

export type RepoMetaLinks = {
  repo: string
  stars: string
  forks: string
  watchers?: string
  releases?: string // Link to releases page
}

export type RepoMeta = {
  provider: ProviderId
  url: string
  stars: number
  forks: number
  watchers?: number
  description?: string | null
  defaultBranch?: string
  links: RepoMetaLinks
}

type UnghRepoResponse = {
  repo: {
    description?: string | null
    stars?: number
    forks?: number
    watchers?: number
    defaultBranch?: string
  } | null
  releases?: Array<{
    tag: string
    name: string
    publishedAt: string
  }> | null
}

/** GitLab API response for project details */
type GitLabProjectResponse = {
  id: number
  description?: string | null
  default_branch?: string
  star_count?: number
  forks_count?: number
}

/** Gitea/Forgejo API response for repository details */
type GiteaRepoResponse = {
  id: number
  description?: string
  default_branch?: string
  stars_count?: number
  forks_count?: number
  watchers_count?: number
}

/** Bitbucket API response for repository details */
type BitbucketRepoResponse = {
  name: string
  full_name: string
  description?: string
  mainbranch?: { name: string }
  // Bitbucket doesn't expose star/fork counts in public API
}

/** Gitee API response for repository details */
type GiteeRepoResponse = {
  id: number
  name: string
  full_name: string
  description?: string
  default_branch?: string
  stargazers_count?: number
  forks_count?: number
  watchers_count?: number
}

/** Radicle API response for project details */
type RadicleProjectResponse = {
  id: string
  name: string
  description?: string
  defaultBranch?: string
  head?: string
  seeding?: number
  delegates?: Array<{ id: string; alias?: string }>
  patches?: { open: number; draft: number; archived: number; merged: number }
  issues?: { open: number; closed: number }
}

/** GitLab releases API response */
type GitLabReleaseResponse = Array<{
  tag_name: string
  name: string
  released_at: string
}>

/** Gitea/Forgejo releases API response */
type GiteaReleaseResponse = Array<{
  tag_name: string
  name: string
  html_url: string
  published_at: string
  draft: boolean
  prerelease: boolean
}>

/** Bitbucket tags API response (used as releases) */
type BitbucketTagResponse = {
  values: Array<{
    name: string
  }>
}

type ProviderAdapter = {
  id: ProviderId
  parse(url: URL): RepoRef | null
  links(ref: RepoRef): RepoMetaLinks
  fetchMeta(
    cachedFetch: CachedFetchFunction,
    ref: RepoRef,
    links: RepoMetaLinks,
    options?: Parameters<typeof $fetch>[1],
  ): Promise<RepoMeta | null>
  fetchReleases(
    cachedFetch: CachedFetchFunction,
    ref: RepoRef,
    options?: Parameters<typeof $fetch>[1],
  ): Promise<Release[]>
}

const githubAdapter: ProviderAdapter = {
  id: 'github',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'github.com' && host !== 'www.github.com') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'github', owner, repo }
  },

  links(ref) {
    const base = `https://github.com/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/stargazers`,
      forks: `${base}/forks`,
      watchers: `${base}/watchers`,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    // Using UNGH to avoid API limitations of the Github API
    let res: UnghRepoResponse | null = null
    try {
      const { data } = await cachedFetch<UnghRepoResponse>(
        `https://ungh.cc/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    const repo = res?.repo
    if (!repo) return null

    return {
      provider: 'github',
      url: links.repo,
      stars: repo.stars ?? 0,
      forks: repo.forks ?? 0,
      watchers: repo.watchers ?? 0,
      description: repo.description ?? null,
      defaultBranch: repo.defaultBranch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    // Using UNGH to avoid API limitations of the Github API
    try {
      const { data } = await cachedFetch<UnghRepoResponse>(
        `https://ungh.cc/repos/${ref.owner}/${ref.repo}/releases`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      const releases = data.releases
      if (!releases) return []

      return releases.map(release => ({
        tag: release.tag,
        url: `https://github.com/${ref.owner}/${ref.repo}/releases/tag/${release.tag}`,
        name: release.name,
        publishedAt: release.publishedAt,
      }))
    } catch {
      return []
    }
  },
}

const gitlabAdapter: ProviderAdapter = {
  id: 'gitlab',

  parse(url) {
    const host = url.hostname.toLowerCase()
    const isGitLab = GITLAB_HOSTS.some(h => host === h || host === `www.${h}`)
    if (!isGitLab) return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    // GitLab supports nested groups, so we join all parts except the last as owner
    const repo = decodeURIComponent(parts[parts.length - 1] ?? '')
      .trim()
      .replace(/\.git$/i, '')
    const owner = parts
      .slice(0, -1)
      .map(p => decodeURIComponent(p).trim())
      .join('/')

    if (!owner || !repo) return null

    return { provider: 'gitlab', owner, repo, host }
  },

  links(ref) {
    const baseHost = ref.host ?? 'gitlab.com'
    const base = `https://${baseHost}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/-/starrers`,
      forks: `${base}/-/forks`,
      releases: `${base}/-/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    const baseHost = ref.host ?? 'gitlab.com'
    const projectPath = encodeURIComponent(`${ref.owner}/${ref.repo}`)
    let res: GitLabProjectResponse | null = null
    try {
      const { data } = await cachedFetch<GitLabProjectResponse>(
        `https://${baseHost}/api/v4/projects/${projectPath}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'gitlab',
      url: links.repo,
      stars: res.star_count ?? 0,
      forks: res.forks_count ?? 0,
      description: res.description ?? null,
      defaultBranch: res.default_branch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    const baseHost = ref.host ?? 'gitlab.com'
    const projectPath = encodeURIComponent(`${ref.owner}/${ref.repo}`)
    try {
      const { data } = await cachedFetch<GitLabReleaseResponse>(
        `https://${baseHost}/api/v4/projects/${projectPath}/releases?per_page=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.map(release => ({
        tag: release.tag_name,
        url: `https://${baseHost}/${ref.owner}/${ref.repo}/-/releases/${release.tag_name}`,
        name: release.name,
        publishedAt: release.released_at,
      }))
    } catch {
      return []
    }
  },
}

const bitbucketAdapter: ProviderAdapter = {
  id: 'bitbucket',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'bitbucket.org' && host !== 'www.bitbucket.org') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'bitbucket', owner, repo }
  },

  links(ref) {
    const base = `https://bitbucket.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Bitbucket doesn't have public stars
      forks: `${base}/forks`,
      releases: `${base}/downloads`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: BitbucketRepoResponse | null = null
    try {
      const { data } = await cachedFetch<BitbucketRepoResponse>(
        `https://api.bitbucket.org/2.0/repositories/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    // Bitbucket doesn't expose star/fork counts in their public API
    return {
      provider: 'bitbucket',
      url: links.repo,
      stars: 0,
      forks: 0,
      description: res.description ?? null,
      defaultBranch: res.mainbranch?.name,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    try {
      const { data } = await cachedFetch<BitbucketTagResponse>(
        `https://api.bitbucket.org/2.0/repositories/${ref.owner}/${ref.repo}/refs/tags?pagelen=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.values.map(tag => ({
        tag: tag.name,
        url: `https://bitbucket.org/${ref.owner}/${ref.repo}/src/${tag.name}`,
      }))
    } catch {
      return []
    }
  },
}

const codebergAdapter: ProviderAdapter = {
  id: 'codeberg',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'codeberg.org' && host !== 'www.codeberg.org') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'codeberg', owner, repo, host: 'codeberg.org' }
  },

  links(ref) {
    const base = `https://codeberg.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Codeberg doesn't have a separate stargazers page
      forks: `${base}/forks`,
      watchers: base,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: GiteaRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteaRepoResponse>(
        `https://codeberg.org/api/v1/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'codeberg',
      url: links.repo,
      stars: res.stars_count ?? 0,
      forks: res.forks_count ?? 0,
      watchers: res.watchers_count ?? 0,
      description: res.description ?? null,
      defaultBranch: res.default_branch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    try {
      const { data } = await cachedFetch<GiteaReleaseResponse>(
        `https://codeberg.org/api/v1/repos/${ref.owner}/${ref.repo}/releases?limit=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.map(release => ({
        tag: release.tag_name,
        url: release.html_url,
        name: release.name,
        publishedAt: release.published_at,
      }))
    } catch {
      return []
    }
  },
}

const giteeAdapter: ProviderAdapter = {
  id: 'gitee',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'gitee.com' && host !== 'www.gitee.com') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'gitee', owner, repo }
  },

  links(ref) {
    const base = `https://gitee.com/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/stargazers`,
      forks: `${base}/members`,
      watchers: `${base}/watchers`,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: GiteeRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteeRepoResponse>(
        `https://gitee.com/api/v5/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'gitee',
      url: links.repo,
      stars: res.stargazers_count ?? 0,
      forks: res.forks_count ?? 0,
      watchers: res.watchers_count ?? 0,
      description: res.description ?? null,
      defaultBranch: res.default_branch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    try {
      const { data } = await cachedFetch<GiteaReleaseResponse>(
        `https://gitee.com/api/v5/repos/${ref.owner}/${ref.repo}/releases?per_page=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.map(release => ({
        tag: release.tag_name,
        url: release.html_url,
        name: release.name,
        publishedAt: release.published_at,
      }))
    } catch {
      return []
    }
  },
}

/**
 * Generic Gitea adapter for self-hosted instances.
 * Matches common Gitea/Forgejo hosting patterns.
 */
const giteaAdapter: ProviderAdapter = {
  id: 'gitea',

  parse(url) {
    const host = url.hostname.toLowerCase()

    // Match common Gitea/Forgejo hosting patterns
    const giteaPatterns = [
      /^git\./i, // git.example.com
      /^gitea\./i, // gitea.example.com
      /^forgejo\./i, // forgejo.example.com
      /^code\./i, // code.example.com
      /^src\./i, // src.example.com
      /gitea\.io$/i, // *.gitea.io
    ]

    // Skip if it matches other known providers
    const skipHosts = [
      'github.com',
      'gitlab.com',
      'codeberg.org',
      'bitbucket.org',
      'gitee.com',
      'sr.ht',
      'git.sr.ht',
      ...GITLAB_HOSTS,
    ]
    if (skipHosts.some(h => host === h || host.endsWith(`.${h}`))) return null

    // Check if matches Gitea patterns
    if (!giteaPatterns.some(p => p.test(host))) return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'gitea', owner, repo, host }
  },

  links(ref) {
    const base = `https://${ref.host}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base,
      forks: `${base}/forks`,
      watchers: base,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    if (!ref.host) return null

    // Note: Generic Gitea instances may not be in the allowlist,
    // so caching may not apply for self-hosted instances
    let res: GiteaRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteaRepoResponse>(
        `https://${ref.host}/api/v1/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'gitea',
      url: links.repo,
      stars: res.stars_count ?? 0,
      forks: res.forks_count ?? 0,
      watchers: res.watchers_count ?? 0,
      description: res.description ?? null,
      defaultBranch: res.default_branch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    if (!ref.host) return []

    try {
      const { data } = await cachedFetch<GiteaReleaseResponse>(
        `https://${ref.host}/api/v1/repos/${ref.owner}/${ref.repo}/releases?limit=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.map(release => ({
        tag: release.tag_name,
        url: release.html_url,
        name: release.name,
        publishedAt: release.published_at,
      }))
    } catch {
      return []
    }
  },
}

const sourcehutAdapter: ProviderAdapter = {
  id: 'sourcehut',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'sr.ht' && host !== 'git.sr.ht') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    // Sourcehut uses ~username/repo format
    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'sourcehut', owner, repo }
  },

  links(ref) {
    const base = `https://git.sr.ht/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Sourcehut doesn't have stars
      forks: base,
      releases: `${base}/refs`,
    }
  },

  async fetchMeta(_cachedFetch, _ref, links) {
    // Sourcehut doesn't have a public API for repo stats
    // Just return basic info without fetching
    return {
      provider: 'sourcehut',
      url: links.repo,
      stars: 0,
      forks: 0,
      links,
    }
  },

  async fetchReleases() {
    // Sourcehut doesn't have a public API for releases
    return []
  },
}

const tangledAdapter: ProviderAdapter = {
  id: 'tangled',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (
      host !== 'tangled.sh' &&
      host !== 'www.tangled.sh' &&
      host !== 'tangled.org' &&
      host !== 'www.tangled.org'
    ) {
      return null
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    // Tangled uses owner/repo format (owner is a domain-like identifier)
    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'tangled', owner, repo }
  },

  links(ref) {
    const base = `https://tangled.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Tangled shows stars on the repo page
      forks: `${base}/fork`,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    try {
      const { data } = await cachedFetch<{ stars: number; forks: number }>(
        `/api/atproto/tangled-stats/${ref.owner}/${ref.repo}`,
        options,
        REPO_META_TTL,
      )

      return {
        provider: 'tangled',
        url: links.repo,
        stars: data.stars,
        forks: data.forks,
        links,
      }
    } catch {
      return {
        provider: 'tangled',
        url: links.repo,
        stars: 0,
        forks: 0,
        links,
      }
    }
  },

  async fetchReleases() {
    // Tangled doesn't have a public API for releases
    return []
  },
}

const radicleAdapter: ProviderAdapter = {
  id: 'radicle',

  parse(url) {
    const host = url.hostname.toLowerCase()
    if (host !== 'radicle.at' && host !== 'app.radicle.at' && host !== 'seed.radicle.at') {
      return null
    }

    // Radicle URLs: app.radicle.at/nodes/seed.radicle.at/rad:z3nP4yT1PE3m1PxLEzr173sZtJVnT
    const path = url.pathname
    const radMatch = path.match(/rad:[a-zA-Z0-9]+/)
    if (!radMatch?.[0]) return null

    // Use empty owner, store full rad: ID as repo
    return { provider: 'radicle', owner: '', repo: radMatch[0], host }
  },

  links(ref) {
    const base = `https://app.radicle.at/nodes/seed.radicle.at/${ref.repo}`
    return {
      repo: base,
      stars: base, // Radicle doesn't have stars, shows seeding count
      forks: base,
      releases: `${base}/patches`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: RadicleProjectResponse | null = null
    try {
      const { data } = await cachedFetch<RadicleProjectResponse>(
        `https://seed.radicle.at/api/v1/projects/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'radicle',
      url: links.repo,
      // Use seeding count as a proxy for "stars" (number of nodes hosting this repo)
      stars: res.seeding ?? 0,
      forks: 0, // Radicle doesn't have forks in the traditional sense
      description: res.description ?? null,
      defaultBranch: res.defaultBranch,
      links,
    }
  },

  async fetchReleases() {
    // Radicle doesn't have a public API for releases
    return []
  },
}

const forgejoAdapter: ProviderAdapter = {
  id: 'forgejo',

  parse(url) {
    const host = url.hostname.toLowerCase()

    // Match explicit Forgejo instances
    const forgejoPatterns = [/^forgejo\./i, /\.forgejo\./i]
    const knownInstances = ['next.forgejo.org', 'try.next.forgejo.org']

    const isMatch = knownInstances.some(h => host === h) || forgejoPatterns.some(p => p.test(host))
    if (!isMatch) return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const owner = decodeURIComponent(parts[0] ?? '').trim()
    const repo = decodeURIComponent(parts[1] ?? '')
      .trim()
      .replace(/\.git$/i, '')

    if (!owner || !repo) return null

    return { provider: 'forgejo', owner, repo, host }
  },

  links(ref) {
    const base = `https://${ref.host}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base,
      forks: `${base}/forks`,
      watchers: base,
      releases: `${base}/releases`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    if (!ref.host) return null

    let res: GiteaRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteaRepoResponse>(
        `https://${ref.host}/api/v1/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )
      res = data
    } catch {
      return null
    }

    if (!res) return null

    return {
      provider: 'forgejo',
      url: links.repo,
      stars: res.stars_count ?? 0,
      forks: res.forks_count ?? 0,
      watchers: res.watchers_count ?? 0,
      description: res.description ?? null,
      defaultBranch: res.default_branch,
      links,
    }
  },

  async fetchReleases(cachedFetch, ref, options = {}) {
    if (!ref.host) return []

    try {
      const { data } = await cachedFetch<GiteaReleaseResponse>(
        `https://${ref.host}/api/v1/repos/${ref.owner}/${ref.repo}/releases?limit=30`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        REPO_META_TTL,
      )

      return data.map(release => ({
        tag: release.tag_name,
        url: release.html_url,
        name: release.name,
        publishedAt: release.published_at,
      }))
    } catch {
      return []
    }
  },
}

// Order matters: more specific adapters should come before generic ones
const providers: readonly ProviderAdapter[] = [
  githubAdapter,
  gitlabAdapter,
  bitbucketAdapter,
  codebergAdapter,
  giteeAdapter,
  sourcehutAdapter,
  tangledAdapter,
  radicleAdapter,
  forgejoAdapter,
  giteaAdapter, // Generic Gitea adapter last as fallback for self-hosted instances
] as const

const parseRepoFromUrl = parseRepoUrl

export function useRepoMeta(repositoryUrl: MaybeRefOrGetter<string | null | undefined>) {
  // Get cachedFetch in setup context (outside async handler)
  const cachedFetch = useCachedFetch()

  const repoRef = computed(() => {
    const url = toValue(repositoryUrl)
    if (!url) return null
    return parseRepoFromUrl(url)
  })

  const { data, pending, error, refresh } = useLazyAsyncData<RepoMeta | null>(
    () =>
      repoRef.value
        ? `repo-meta:${repoRef.value.provider}:${repoRef.value.owner}/${repoRef.value.repo}`
        : 'repo-meta:none',
    async (_nuxtApp, { signal }) => {
      const ref = repoRef.value
      if (!ref) return null

      const adapter = providers.find(provider => provider.id === ref.provider)
      if (!adapter) return null

      const links = adapter.links(ref)
      return await adapter.fetchMeta(cachedFetch, ref, links, { signal })
    },
  )

  const meta = computed<RepoMeta | null>(() => data.value ?? null)

  // Separate releases fetch
  const {
    data: releasesData,
    pending: releasesPending,
    error: releasesError,
    refresh: refreshReleases,
  } = useLazyAsyncData<Release[]>(
    () =>
      repoRef.value
        ? `repo-releases:${repoRef.value.provider}:${repoRef.value.owner}/${repoRef.value.repo}`
        : 'repo-releases:none',
    async (_nuxtApp, { signal }) => {
      const ref = repoRef.value
      if (!ref) return []

      const adapter = providers.find(provider => provider.id === ref.provider)
      if (!adapter) return []

      return await adapter.fetchReleases(cachedFetch, ref, { signal })
    },
  )

  const releases = computed<Release[]>(() => releasesData.value ?? [])

  return {
    repoRef,
    meta,

    // TODO(serhalp): Consider removing the zero fallback so callers can make a distinction between
    // "unresolved data" and "zero value"
    stars: computed(() => meta.value?.stars ?? 0),
    forks: computed(() => meta.value?.forks ?? 0),
    watchers: computed(() => meta.value?.watchers ?? 0),

    starsLink: computed(() => meta.value?.links.stars ?? null),
    forksLink: computed(() => meta.value?.links.forks ?? null),
    watchersLink: computed(() => meta.value?.links.watchers ?? null),
    repoLink: computed(() => meta.value?.links.repo ?? null),
    releasesLink: computed(() => meta.value?.links.releases ?? null),

    // Releases data and loading state
    releases,
    releasesPending,
    releasesError,
    refreshReleases,

    pending,
    error,
    refresh,
  }
}
