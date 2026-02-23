import type { RepoRef } from '#shared/utils/git-providers'

type StarStatus = {
  starred: boolean
  connected: boolean
}

export function useGitHubStar(repoRef: Ref<RepoRef | null>) {
  const { isConnected } = useGitHub()

  const isGitHubRepo = computed(() => repoRef.value?.provider === 'github')
  const owner = computed(() => repoRef.value?.owner ?? '')
  const repo = computed(() => repoRef.value?.repo ?? '')

  const shouldFetch = computed(
    () => isConnected.value && isGitHubRepo.value && !!owner.value && !!repo.value,
  )

  const { data: starStatus, refresh } = useFetch<StarStatus>(
    () => `/api/github/starred?owner=${owner.value}&repo=${repo.value}`,
    {
      server: false,
      immediate: false,
      default: () => ({ starred: false, connected: false }),
      watch: false,
    },
  )

  watch(
    shouldFetch,
    async value => {
      if (value) {
        await refresh()
      }
    },
    { immediate: true },
  )

  const isStarred = computed(() => starStatus.value?.starred ?? false)
  const isStarActionPending = shallowRef(false)

  async function toggleStar() {
    if (!shouldFetch.value || isStarActionPending.value) return

    const currentlyStarred = isStarred.value

    // Optimistic update
    starStatus.value = {
      starred: !currentlyStarred,
      connected: true,
    }

    isStarActionPending.value = true

    try {
      const result = await $fetch<{ starred: boolean }>('/api/github/star', {
        method: currentlyStarred ? 'DELETE' : 'PUT',
        body: { owner: owner.value, repo: repo.value },
      })

      starStatus.value = { starred: result.starred, connected: true }
    } catch {
      // Revert on error
      starStatus.value = {
        starred: currentlyStarred,
        connected: true,
      }
    } finally {
      isStarActionPending.value = false
    }
  }

  return {
    isStarred,
    isStarActionPending,
    isGitHubRepo,
    toggleStar,
  }
}
