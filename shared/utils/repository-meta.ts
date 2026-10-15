import type { FetchLike } from 'forges'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import type { ProviderId, RepoRef } from '#shared/utils/git-providers'
import { GIT_PROVIDER_API_ORIGINS } from '#shared/utils/git-providers'
import { createForgeProvider, forgeWeb, toForgeRepoRef } from '#shared/utils/forges'

// TTL for git repo metadata (10 minutes - repo stats don't change frequently)
const REPO_META_TTL = 60 * 10
// Other TTLs for known sources
const UNGH_REPO_META_TTL = 60 * 60 * 3 // 3 hours (ungh caches 6 hours server-side, but we run it half more frequently)

type RepoMetaLinks = {
  repo: string
  forks?: string
}

export type RepoMeta = {
  provider: ProviderId
  url: string
  /** Absent when the forge did not report a count, which is not the same as zero. */
  stars?: number
  forks?: number
  links: RepoMetaLinks
}

/** What `/api/atproto/tangled-stats` returns. */
export type TangledStats = {
  stars: number
  forks: number
}

type UnghRepoResponse = {
  repo: {
    stars?: number
    forks?: number
  } | null
}

/** Radicle API response for project details. */
type RadicleProjectResponse = {
  seeding?: number
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

function linksFor(ref: RepoRef): RepoMetaLinks {
  const web = forgeWeb(ref)
  const repo = toForgeRepoRef(ref)
  // Fall back to the repository page where the forge has no dedicated one.
  const page = web?.urlFor({ repo }) ?? ''
  return {
    repo: page,
    forks: web?.urlFor({ repo, section: 'forks' }) ?? page,
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
      stars: repo.stars,
      forks: repo.forks,
      links,
    }
  },
}

/**
 * Metadata from `forges`. GitHub (ungh), Sourcehut (token), Tangled (server) and
 * Radicle have their own adapters.
 */
function forgeAdapter(): ProviderAdapter {
  return {
    links: linksFor,
    async fetchMeta(cachedFetch, ref, links, options = {}) {
      const provider = await createForgeProvider(ref, {
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
          stars: repo.stars,
          forks: repo.forks,
          links,
        }
      } catch {
        return null
      }
    },
  }
}

/**
 * Presents npmx's `cachedFetch` as the `Response`-shaped fetch `forges` expects.
 * It loses `Link`/`ETag`, so only unpaginated reads (`repos.get()`) are sound.
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

/**
 * Sourcehut's links come from `forges`; its metadata needs a token npmx does not
 * have, and it reports no stars or forks, so a request would buy nothing.
 */
const sourcehutAdapter: ProviderAdapter = {
  links: linksFor,

  async fetchMeta(_cachedFetch, _ref, links) {
    return {
      provider: 'sourcehut',
      url: links.repo,
      stars: 0,
      forks: 0,
      links,
    }
  },
}

/**
 * Tangled is read on the server: it reaches hosts the browser's CSP cannot list
 * (see `/api/atproto/tangled-stats`).
 */
const tangledAdapter: ProviderAdapter = {
  links: linksFor,

  async fetchMeta(cachedFetch, ref, links, options = {}) {
    try {
      const { data } = await cachedFetch<TangledStats>(
        `/api/atproto/tangled-stats/${ref.owner}/${ref.repo}`,
        options,
        REPO_META_TTL,
      )
      return { provider: 'tangled', url: links.repo, ...data, links }
    } catch {
      return null
    }
  },
}

const radicleAdapter: ProviderAdapter = {
  links(ref) {
    // Radicle refs store the full rad: ID as repo with no owner.
    const base = `https://app.radicle.at/nodes/seed.radicle.at/${ref.repo}`
    return {
      repo: base,
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

/** Adapter for exact allowlisted Forgejo instances. */
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
