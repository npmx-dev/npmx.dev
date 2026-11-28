import type { OwnCollection } from '#shared/types/social'
import { fetchOwnCollections } from '~/utils/atproto/collections'

/** The signed-in user's collections, for finding them from the command palette. */
export function useOwnCollections() {
  const { user } = useAtproto()
  const state = useState<{ did: string; items: OwnCollection[] } | null>(
    'own-collections',
    () => null,
  )
  const status = useState<'idle' | 'pending' | 'error'>('own-collections:status', () => 'idle')

  const collections = computed(() =>
    state.value && state.value.did === user.value?.did ? state.value.items : null,
  )

  async function load({ force = false } = {}) {
    const did = user.value?.did
    if (!did || (!force && (collections.value || status.value === 'pending'))) return
    status.value = 'pending'
    try {
      const items = await fetchOwnCollections()
      if (user.value?.did === did) state.value = { did, items }
      status.value = 'idle'
    } catch {
      status.value = 'error'
    }
  }

  return { collections, status, load }
}
