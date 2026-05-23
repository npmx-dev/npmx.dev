import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import type { ProviderId, RepoRef } from '#shared/utils/git-providers'
import { GIT_PROVIDER_API_ORIGINS } from '#shared/utils/git-providers'

// TTL for git repo metadata (10 minutes - repo stats don't change frequently)
const REPO_META_TTL = 60 * 10
// Other TTLs for known sources
const UNGH_REPO_META_TTL = 60 * 60 * 3 // 3 hours (ungh caches 6 hours server-side, but we run it half more frequently)

export type RepoMetaLinks = {
  repo: string
  stars: string
  forks: string
  watchers?: string
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

type ProviderAdapter = {
  links(ref: RepoRef): RepoMetaLinks
  fetchMeta(
    cachedFetch: CachedFetchFunction,
    ref: RepoRef,
    links: RepoMetaLinks,
    options?: Parameters<typeof $fetch>[1],
  ): Promise<RepoMeta | null>
}

const githubAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://github.com/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/stargazers`,
      forks: `${base}/forks`,
      watchers: `${base}/watchers`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    // Using UNGH to avoid API limitations of the GitHub API
    let res: UnghRepoResponse | null = null
    try {
      const { data } = await cachedFetch<UnghRepoResponse>(
        `${GIT_PROVIDER_API_ORIGINS.github}/repos/${ref.owner}/${ref.repo}`,
        { headers: { 'User-Agent': 'npmx', ...options.headers }, ...options },
        UNGH_REPO_META_TTL,
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
}

const gitlabAdapter: ProviderAdapter = {
  links(ref) {
    const baseHost = ref.host ?? 'gitlab.com'
    const base = `https://${baseHost}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/-/starrers`,
      forks: `${base}/-/forks`,
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
}

const bitbucketAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://bitbucket.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Bitbucket doesn't have public stars
      forks: `${base}/forks`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: BitbucketRepoResponse | null = null
    try {
      const { data } = await cachedFetch<BitbucketRepoResponse>(
        `${GIT_PROVIDER_API_ORIGINS.bitbucket}/2.0/repositories/${ref.owner}/${ref.repo}`,
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
}

const codebergAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://codeberg.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Codeberg doesn't have a separate stargazers page
      forks: `${base}/forks`,
      watchers: base,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: GiteaRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteaRepoResponse>(
        `${GIT_PROVIDER_API_ORIGINS.codeberg}/api/v1/repos/${ref.owner}/${ref.repo}`,
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
}

const giteeAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://gitee.com/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: `${base}/stargazers`,
      forks: `${base}/members`,
      watchers: `${base}/watchers`,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: GiteeRepoResponse | null = null
    try {
      const { data } = await cachedFetch<GiteeRepoResponse>(
        `${GIT_PROVIDER_API_ORIGINS.gitee}/api/v5/repos/${ref.owner}/${ref.repo}`,
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
}

/**
 * Generic Gitea adapter for self-hosted instances.
 */
const giteaAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://${ref.host}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base,
      forks: `${base}/forks`,
      watchers: base,
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
}

const sourcehutAdapter: ProviderAdapter = {
  links(ref) {
    // Sourcehut uses ~username/repo format.
    const base = `https://git.sr.ht/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Sourcehut doesn't have stars
      forks: base,
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
}

const tangledAdapter: ProviderAdapter = {
  links(ref) {
    // Tangled uses owner/repo format, where owner is a domain-like identifier.
    const base = `https://tangled.org/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base, // Tangled shows stars on the repo page
      forks: `${base}/fork`,
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
}

const radicleAdapter: ProviderAdapter = {
  links(ref) {
    // Radicle refs store the full rad: ID as repo with no owner.
    const base = `https://app.radicle.at/nodes/seed.radicle.at/${ref.repo}`
    return {
      repo: base,
      stars: base, // Radicle doesn't have stars, shows seeding count
      forks: base,
    }
  },

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    let res: RadicleProjectResponse | null = null
    try {
      const { data } = await cachedFetch<RadicleProjectResponse>(
        `${GIT_PROVIDER_API_ORIGINS.radicle}/api/v1/projects/${ref.repo}`,
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
}

/**
 * Adapter for explicit Forgejo instances.
 */
const forgejoAdapter: ProviderAdapter = {
  links(ref) {
    const base = `https://${ref.host}/${ref.owner}/${ref.repo}`
    return {
      repo: base,
      stars: base,
      forks: `${base}/forks`,
      watchers: base,
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
}

const providers = {
  github: githubAdapter,
  gitlab: gitlabAdapter,
  bitbucket: bitbucketAdapter,
  codeberg: codebergAdapter,
  gitee: giteeAdapter,
  sourcehut: sourcehutAdapter,
  tangled: tangledAdapter,
  radicle: radicleAdapter,
  forgejo: forgejoAdapter,
  gitea: giteaAdapter,
} satisfies Record<ProviderId, ProviderAdapter>

function getProviderAdapter(ref: RepoRef): ProviderAdapter | null {
  return providers[ref.provider] ?? null
}

export function getRepoMetaLinks(ref: RepoRef): RepoMetaLinks | null {
  const adapter = getProviderAdapter(ref)
  return adapter?.links(ref) ?? null
}

export async function getRepoMeta(
  cachedFetch: CachedFetchFunction,
  ref: RepoRef,
  options: Parameters<typeof $fetch>[1] = {},
): Promise<RepoMeta | null> {
  const adapter = getProviderAdapter(ref)
  if (!adapter) return null

  const links = adapter.links(ref)
  return await adapter.fetchMeta(cachedFetch, ref, links, options)
}

export async function getRepositoryStars(
  cachedFetch: CachedFetchFunction,
  ref: RepoRef,
  options: Parameters<typeof $fetch>[1] = {},
): Promise<number | null> {
  const meta = await getRepoMeta(cachedFetch, ref, options)
  return meta?.stars ?? null
}
