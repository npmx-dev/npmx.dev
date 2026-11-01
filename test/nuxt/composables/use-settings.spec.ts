import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

describe('useSettings - keyboardShortcuts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('default value', () => {
    it('should default keyboardShortcuts to true', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      expect(settings.value.keyboardShortcuts).toBe(true)
    })
  })

  describe('useKeyboardShortcuts composable', () => {
    it('should return true by default', async () => {
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const enabled = useKeyboardShortcuts()
      expect(enabled.value).toBe(true)
    })

    it('should reflect changes made via settings', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const enabled = useKeyboardShortcuts()

      settings.value.keyboardShortcuts = false
      expect(enabled.value).toBe(false)

      settings.value.keyboardShortcuts = true
      expect(enabled.value).toBe(true)
    })

    it('should be reactive', async () => {
      const { useSettings } = await import('~/composables/useSettings')
      const { useKeyboardShortcuts } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const enabled = useKeyboardShortcuts()

      expect(enabled.value).toBe(true)

      settings.value.keyboardShortcuts = false
      expect(enabled.value).toBe(false)
    })
  })
})

describe('useSettings - codeLigatures', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('has a default value of true', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const codeLigatures = useSettings().settings.value.codeLigatures
    expect(codeLigatures).toBe(true)
  })

  describe('useCodeLigatures', () => {
    it('has a default value of true', async () => {
      const { useCodeLigatures } = await import('~/composables/useSettings')
      const codeLigatures = useCodeLigatures().codeLigatures
      expect(codeLigatures.value).toBe(true)
    })

    it('updates after toggle', async () => {
      const { useCodeLigatures } = await import('~/composables/useSettings')
      const { codeLigatures, toggleCodeLigatures } = useCodeLigatures()
      expect(codeLigatures.value).toBe(true)
      toggleCodeLigatures()
      expect(codeLigatures.value).toBe(false)
    })
  })
})

describe('useSettings - resetSettings', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // Persisted settings (e.g. selectedLocale) would leak into other test files
  afterEach(() => {
    localStorage.clear()
  })

  it('restores defaults and keeps the selected locale', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const { settings, resetSettings } = useSettings()

    settings.value.relativeDates = true
    settings.value.keyboardShortcuts = false
    settings.value.accentColorId = 'coral'
    settings.value.sidebar.collapsed = ['readme']
    settings.value.selectedLocale = 'fr-FR'

    resetSettings()

    expect(settings.value.relativeDates).toBe(false)
    expect(settings.value.keyboardShortcuts).toBe(true)
    expect(settings.value.accentColorId).toBeNull()
    expect(settings.value.sidebar.collapsed).toEqual([])
    expect(settings.value.selectedLocale).toBe('fr-FR')
  })

  it('clears theme attributes from the document', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const { resetSettings } = useSettings()

    document.documentElement.style.setProperty('--accent-color', 'var(--swatch-coral)')
    document.documentElement.dataset.bgTheme = 'slate'
    document.documentElement.dataset.fgTheme = 'contrast'
    document.documentElement.dataset.collapsed = 'readme'

    resetSettings()

    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('')
    expect(document.documentElement.dataset.bgTheme).toBeUndefined()
    expect(document.documentElement.dataset.fgTheme).toBeUndefined()
    expect(document.documentElement.dataset.collapsed).toBeUndefined()
  })
})
