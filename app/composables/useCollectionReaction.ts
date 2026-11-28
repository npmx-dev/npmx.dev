import type { Ref } from 'vue'
import type { ReactionState } from '#shared/types/social'
import { toggleCollectionReaction, type Reaction } from '~/utils/atproto/collections'

/** Optimistic like or follow toggle for a collection; opens sign-in when signed out. */
export function useCollectionReaction(
  state: Ref<ReactionState>,
  reaction: Reaction,
  target: () => { identifier: string; rkey: string },
) {
  const { user } = useAtproto()
  const authModal = useModal('auth-modal')
  const isPending = shallowRef(false)

  async function toggle() {
    const handle = user.value?.handle
    if (handle == null) {
      authModal.open()
      return
    }
    if (isPending.value) return

    const previous = state.value
    state.value = {
      total: previous.total + (previous.viewerHas ? -1 : 1),
      viewerHas: !previous.viewerHas,
    }
    isPending.value = true
    try {
      const { identifier, rkey } = target()
      state.value = await toggleCollectionReaction(
        identifier,
        rkey,
        reaction,
        previous.viewerHas,
        handle,
      )
    } catch {
      state.value = previous
    } finally {
      isPending.value = false
    }
  }

  return { toggle }
}
