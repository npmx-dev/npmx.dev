export function useModal(modalId: string) {
  const getModal = () => document.querySelector<HTMLDialogElement>(`#${modalId}`)

  function open() {
    const modal = getModal()
    if (modal) {
      setTimeout(() => {
        modal.showModal()
      })
    }
  }

  function close() {
    const modal = getModal()
    if (modal) {
      modal.close()
    }
  }

  return {
    open,
    close,
  }
}
