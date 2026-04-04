import type { RouteLocationRaw } from 'vue-router'
import { isEditableElement, isKeyWithoutModifiers } from '~/utils/input'

type ShortcutTarget = RouteLocationRaw | null | undefined
type ShortcutTargetFactory = () => ShortcutTarget

const registry = new Map<string, ShortcutTargetFactory[]>()

export function initKeyShortcuts() {
  const keyboardShortcuts = useKeyboardShortcuts()

  onKeyStroke(
    e => !e.repeat && keyboardShortcuts.value && !isEditableElement(e.target),
    e => {
      for (const [key, stack] of registry) {
        if (!isKeyWithoutModifiers(e, key)) continue
        const getTarget = stack.at(-1)
        if (!getTarget) continue
        const target = getTarget()
        if (!target) return
        e.preventDefault()
        navigateTo(target)
        return
      }
    },
  )
}

export function useShortcuts(map: Record<string, () => ShortcutTarget>) {
  if (!import.meta.client) return

  for (const [key, fn] of Object.entries(map)) {
    const entry = registry.get(key) ?? []
    if (entry.includes(fn)) continue
    entry.push(fn)
    registry.set(key, entry)
  }

  onScopeDispose(() => {
    for (const [key, fn] of Object.entries(map)) {
      const stack = registry.get(key)
      if (!stack) continue
      const idx = stack.lastIndexOf(fn)
      if (idx !== -1) stack.splice(idx, 1)
    }
  })
}
