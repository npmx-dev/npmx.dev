export function isTouchDevice() {
  if (import.meta.server) {
    return false
  }
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}
