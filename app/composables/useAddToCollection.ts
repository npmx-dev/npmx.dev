export const ADD_TO_COLLECTION_MODAL_ID = 'add-to-collection-modal'

/** Opens the add-to-collection picker for some packages, or sign-in when signed out. */
export function useAddToCollection() {
  const packages = useState<string[]>('add-to-collection:packages', () => [])
  // Remounts the picker on every open so it starts from fresh collections
  const openCount = useState('add-to-collection:open-count', () => 0)
  const { user } = useAtproto()
  const authModal = useModal('auth-modal')
  const modal = useModal(ADD_TO_COLLECTION_MODAL_ID)

  function open(packageNames: string[]) {
    if (!user.value?.handle) {
      authModal.open()
      return
    }
    packages.value = packageNames
    openCount.value++
    modal.open()
  }

  return { packages, openCount, open }
}
