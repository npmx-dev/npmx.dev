import type { OwnCollection } from '#shared/types/social'
import {
  changeCollectionItems,
  createCollection,
  fetchOwnCollections,
} from '~/utils/atproto/collections'

/** The signed-in user's collections, shared by the add-to-collection picker and the palette. */
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

  async function changeItems(
    collection: OwnCollection,
    change: { add?: string[]; remove?: string[] },
  ) {
    const { subjectRefs, cid } = await changeCollectionItems(
      collection.did,
      collection.rkey,
      change,
      user.value?.handle,
    )
    // The server's answer is the record as written, so it can be applied as is
    const items = state.value?.items.map(c =>
      c.uri === collection.uri ? { ...c, cid, subjectRefs, itemCount: subjectRefs.length } : c,
    )
    if (state.value && items) state.value = { ...state.value, items }
  }

  async function create(name: string, subjectRefs: string[]) {
    await createCollection(
      { name, items: subjectRefs.map(subjectRef => ({ subjectRef })) },
      user.value?.handle,
    )
    await load({ force: true })
  }

  return { collections, status, load, changeItems, create }
}
