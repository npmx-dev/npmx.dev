type ProviderId = 'github' // Could be extended to support other providers (gitlab, codeforge, tangled...)
export type RepoRef = { provider: ProviderId; owner: string; repo: string }

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

function normalizeInputToUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  const normalized = raw.replace(/^git\+/, '')

  if (!/^https?:\/\//i.test(normalized)) {
    const scp = normalized.match(/^(?:git@)?([^:/]+):(.+)$/i)
    if (scp?.[1] && scp?.[2]) {
      const host = scp[1]
      const path = scp[2].replace(/^\/*/, '')
      return `https://${host}/${path}`
    }
  }

  return normalized
}

type ProviderAdapter = {
  id: ProviderId
  parse(url: URL): RepoRef | null
  links(ref: RepoRef): RepoMetaLinks
  fetchMeta(ref: RepoRef, links: RepoMetaLinks): Promise<RepoMeta | null>
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
    }
  },

  async fetchMeta(ref, links) {
    // Using UNGH to avoid API limitations of the Github API
    const res = await $fetch<UnghRepoResponse>(`https://ungh.cc/repos/${ref.owner}/${ref.repo}`, {
      headers: { 'User-Agent': 'npmx' },
    }).catch(() => null)

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

const providers: readonly ProviderAdapter[] = [githubAdapter] as const

function parseRepoFromUrl(input: string): RepoRef | null {
  const normalized = normalizeInputToUrl(input)
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    for (const provider of providers) {
      const ref = provider.parse(url)
      if (ref) return ref
    }
    return null
  } catch {
    return null
  }
}

async function fetchRepoMeta(ref: RepoRef): Promise<RepoMeta | null> {
  const adapter = providers.find(provider => provider.id === ref.provider)
  if (!adapter) return null

  const links = adapter.links(ref)
  return await adapter.fetchMeta(ref, links)
}

export function useRepoMeta(repositoryUrl: MaybeRefOrGetter<string | null | undefined>) {
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
    async () => {
      const ref = repoRef.value
      if (!ref) return null
      return await fetchRepoMeta(ref)
    },
  )

  const meta = computed<RepoMeta | null>(() => data.value ?? null)

  return {
    repoRef,
    meta,

    stars: computed(() => meta.value?.stars ?? 0),
    forks: computed(() => meta.value?.forks ?? 0),
    watchers: computed(() => meta.value?.watchers ?? 0),

    starsLink: computed(() => meta.value?.links.stars ?? null),
    forksLink: computed(() => meta.value?.links.forks ?? null),
    watchersLink: computed(() => meta.value?.links.watchers ?? null),
    repoLink: computed(() => meta.value?.links.repo ?? null),

    pending,
    error,
    refresh,
  }
}
