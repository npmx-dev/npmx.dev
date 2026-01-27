/**
 * Composable for copying text to clipboard with a "copied" state.
 * The copied state automatically resets after a timeout.
 */
export function useCopyToClipboard(timeout = 2000) {
  const copied = ref(false)

  async function copy(text: string | undefined | null) {
    if (!text) return false
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), timeout)
    return true
  }

  return { copied, copy }
}
