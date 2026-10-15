import type { FetchLike } from 'forges'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import type { ProviderId, RepoRef } from '#shared/utils/git-providers'
import { GIT_PROVIDER_API_ORIGINS } from '#shared/utils/git-providers'
import { createForgeProvider, toForgeRepoRef } from '#shared/utils/forges'

// TTL for git repo metadata (10 minutes - repo stats don't change frequently)
const REPO_META_TTL = 60 * 10
// Other TTLs for known sources
const UNGH_REPO_META_TTL = 60 * 60 * 3 // 3 hours (ungh caches 6 hours server-side, but we run it half more frequently)

export type RepoMetaLinks = {
  repo: string
  stars?: string
  forks?: string
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

/** Repository page links, built from `forges`. */
function linksFor(ref: RepoRef): RepoMetaLinks {
  const provider = createForgeProvider(ref)
  const repo = toForgeRepoRef(ref)
  // Fall back to the repository page where the forge has no dedicated one.
  const page = provider?.urlFor({ repo }) ?? ''
  return {
    repo: page,
    stars: provider?.urlFor({ repo, section: 'stargazers' }) ?? page,
    forks: provider?.urlFor({ repo, section: 'forks' }) ?? page,
    watchers: provider?.urlFor({ repo, section: 'watchers' }) ?? page,
  }
}

const githubAdapter: ProviderAdapter = {
  links: linksFor,

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    // Using UNGH to avoid API limitations of the GitHub API
    // TODO(serhalp): refactor to use `forges` once it can read GitHub through a
    // proxy; ungh is here only to stay under GitHub's anonymous rate limit.
    let res: UnghRepoResponse | null = null
    try {
      const { data } = await cachedFetch<UnghRepoResponse>(
        `${GIT_PROVIDER_API_ORIGINS.github}/repos/${ref.owner}/${ref.repo}`,
        { ...options, headers: { 'User-Agent': 'npmx', ...options.headers } },
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

/**
 * Adapter backed by `forges` for every provider it supports. npmx keeps its own
 * adapters for GitHub (which is deliberately proxied through ungh.cc) and the
 * providers `forges` does not cover (Sourcehut, Radicle).
 */
function forgeAdapter(): ProviderAdapter {
  return {
    links: linksFor,
    async fetchMeta(cachedFetch, ref, links, options = {}) {
      const provider = createForgeProvider(ref, {
        fetch: cachedFetchAsFetchLike(cachedFetch, REPO_META_TTL),
      })
      if (!provider) return null

      try {
        const repo = await provider.repos.get(toForgeRepoRef(ref), {
          signal: options?.signal ?? undefined,
        })
        return {
          provider: ref.provider,
          url: links.repo,
          stars: repo.stars ?? 0,
          forks: repo.forks ?? 0,
          watchers: repo.watchers,
          description: repo.description ?? null,
          defaultBranch: repo.defaultBranch,
          links,
        }
      } catch {
        return null
      }
    },
  }
}

/**
 * Presents npmx's `cachedFetch` (which wraps `$fetch` and returns a
 * `{ data }` envelope) as the `Response`-shaped `fetch` that `forges` expects.
 *
 * Two caveats, both inherent to the mismatch: the response is re-serialised, so
 * `Link`/`ETag` headers that `forges` uses for pagination and conditional
 * requests are lost; and a non-2xx status has to be recovered from the thrown
 * `FetchError`. For `repos.get()` (a single, unpaginated read) neither matters.
 */
function cachedFetchAsFetchLike(cachedFetch: CachedFetchFunction, ttl: number): FetchLike {
  return async (input, init = {}) => {
    try {
      const requestOptions = {
        method: init.method,
        headers: init.headers,
        body: init.body as BodyInit | undefined,
        signal: init.signal ?? undefined,
      } as Parameters<typeof $fetch>[1]
      const { data } = await cachedFetch(input, requestOptions, ttl)
      return jsonResponse(data, 200)
    } catch (error) {
      const status =
        (error as { response?: { status?: number } })?.response?.status ??
        (error as { statusCode?: number })?.statusCode ??
        502
      return jsonResponse((error as { data?: unknown })?.data, status)
    }
  }
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(typeof data === 'string' ? data : JSON.stringify(data ?? null), {
    status,
    headers: { 'content-type': 'application/json' },
  })
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
    // TODO(serhalp): refactor to use `forges` once it has a Sourcehut provider.
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

const tangledAdapter = forgeAdapter()

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
    // TODO(serhalp): refactor to use `forges` once it has a Radicle provider.
    let res: RadicleProjectResponse | null = null
    try {
      const { data } = await cachedFetch<RadicleProjectResponse>(
        `${GIT_PROVIDER_API_ORIGINS.radicle}/api/v1/projects/${ref.repo}`,
        { ...options, headers: { 'User-Agent': 'npmx', ...options.headers } },
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

const pushinAdapter = forgeAdapter()

// Providers that fetch their metadata through `forges`.
const gitlabAdapter = forgeAdapter()

const bitbucketAdapter = forgeAdapter()

const codebergAdapter = forgeAdapter()

const giteeAdapter = forgeAdapter()

/**
 * Adapter for exact allowlisted Gitea instances.
 */
const giteaAdapter = forgeAdapter()

/**
 * Adapter for exact allowlisted Forgejo instances.
 */
const forgejoAdapter = forgeAdapter()

const providers = {
  github: githubAdapter,
  gitlab: gitlabAdapter,
  bitbucket: bitbucketAdapter,
  codeberg: codebergAdapter,
  gitee: giteeAdapter,
  sourcehut: sourcehutAdapter,
  tangled: tangledAdapter,
  radicle: radicleAdapter,
  pushin: pushinAdapter,
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
