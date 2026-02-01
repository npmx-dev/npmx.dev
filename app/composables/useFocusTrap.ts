const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    el => el.offsetParent !== null,
  )
}

export function useFocusTrap() {
  const trapRef = ref<HTMLElement | null>(null)
  let previousActiveElement: HTMLElement | null = null

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !trapRef.value) return

    const focusables = getFocusableElements(trapRef.value)
    if (focusables.length === 0) return

    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  function activate() {
    if (!trapRef.value) return
    previousActiveElement = document.activeElement as HTMLElement
    document.addEventListener('keydown', handleKeydown)
    const focusables = getFocusableElements(trapRef.value)
    focusables[0]?.focus()
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeydown)
    previousActiveElement?.focus()
    previousActiveElement = null
  }

  watch(trapRef, el => (el ? activate() : deactivate()))
  onUnmounted(deactivate)

  return { trapRef, activate, deactivate }
}
