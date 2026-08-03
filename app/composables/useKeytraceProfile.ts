import type { KeytraceAccount, KeytraceResponse } from '#shared/types/keytrace'

const statusPriority: Record<KeytraceAccount['status'], number> = {
  verified: 0,
  unverified: 1,
  stale: 2,
  failed: 3,
}

export function useKeytraceProfile(domain: MaybeRefOrGetter<string>) {
  const asyncData = useFetch<KeytraceResponse>(
    () => `/api/keytrace/${encodeURIComponent(toValue(domain))}`,
    {
      default: () => ({
        profile: {
          name: '',
          avatar: '',
          description: '',
        },
        accounts: [],
      }),
    },
  )

  const profile = computed(() => asyncData.data.value?.profile)
  const accounts = computed(() => asyncData.data.value?.accounts ?? [])

  const sortedAccounts = computed(() =>
    [...accounts.value].sort((a, b) => {
      const statusSort = statusPriority[a.status] - statusPriority[b.status]
      if (statusSort !== 0) {
        return statusSort
      }

      return a.platform.localeCompare(b.platform)
    }),
  )

  const verifiedAccounts = computed(() =>
    sortedAccounts.value.filter(account => account.status === 'verified'),
  )

  const nonVerifiedAccounts = computed(() =>
    sortedAccounts.value.filter(account => account.status !== 'verified'),
  )

  return {
    profile,
    accounts: sortedAccounts,
    verifiedAccounts,
    nonVerifiedAccounts,
    loading: asyncData.pending,
  }
}
