import { parseRepoUrl } from '#shared/utils/git-providers'
import { getRepoMeta, type RepoMeta } from '#shared/utils/repository-meta'

export function useRepoMeta(repositoryUrl: MaybeRefOrGetter<string | null | undefined>) {
  // Get cachedFetch in setup context (outside async handler)
  const cachedFetch = useCachedFetch()

  const repoRef = computed(() => {
    const url = toValue(repositoryUrl)
    if (!url) return null
    return parseRepoUrl(url)
  })

  const { data, pending, error, refresh } = useLazyAsyncData<RepoMeta | null>(
    () =>
      repoRef.value
        ? `repo-meta:${repoRef.value.provider}:${repoRef.value.owner}/${repoRef.value.repo}`
        : 'repo-meta:none',
    async (_nuxtApp, { signal }) => {
      const ref = repoRef.value
      if (!ref) return null

      return await getRepoMeta(cachedFetch, ref, { signal })
    },
  )

  const meta = computed<RepoMeta | null>(() => data.value ?? null)

  return {
    repoRef,
    meta,

    // TODO(serhalp): Consider removing the zero fallback so callers can make a distinction between
    // "unresolved data" and "zero value"
    stars: computed(() => meta.value?.stars ?? 0),
    forks: computed(() => meta.value?.forks ?? 0),
    watchers: computed(() => meta.value?.watchers ?? 0),

    forksLink: computed(() => meta.value?.links.forks ?? null),
    watchersLink: computed(() => meta.value?.links.watchers ?? null),
    repoLink: computed(() => meta.value?.links.repo ?? null),

    pending,
    error,
    refresh,
  }
}
