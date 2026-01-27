import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export interface AccentColor {
  id: string
  name: string
  value: string
}

export const ACCENT_COLORS = [
  { id: 'rose', name: 'Rose', value: '#e9aeba' },
  { id: 'amber', name: 'Amber', value: '#fbbf24' },
  { id: 'emerald', name: 'Emerald', value: '#34d399' },
  { id: 'sky', name: 'Sky', value: '#38bdf8' },
  { id: 'violet', name: 'Violet', value: '#a78bfa' },
  { id: 'coral', name: 'Coral', value: '#fb7185' },
] as const satisfies readonly AccentColor[]

export type ColorId = (typeof ACCENT_COLORS)[number]['id']

function applyColorToDocument(color: string | null) {
  if (color) {
    document.documentElement.style.setProperty('--accent-color', color)
  } else {
    document.documentElement.style.removeProperty('--accent-color')
  }
}

export function useAccentColor() {
  const accentColorId = useLocalStorage<string | null>('app-accent', null)

  function setAccentColor(id: ColorId | null) {
    const chosenColor = ACCENT_COLORS.find(color => color.id === id)?.value ?? null
    applyColorToDocument(chosenColor)
    accentColorId.value = id
  }

  return {
    accentColorId: computed(() => accentColorId.value),
    setAccentColor,
  }
}
