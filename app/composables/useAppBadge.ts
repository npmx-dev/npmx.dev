const canBadge = import.meta.client && 'setAppBadge' in navigator

export function useAppBadge() {
  function setBadge(count?: number) {
    if (!canBadge) return
    navigator.setAppBadge(count).catch(() => {})
  }

  function clearBadge() {
    if (!canBadge) return
    navigator.clearAppBadge().catch(() => {})
  }

  return { canBadge, setBadge, clearBadge }
}
