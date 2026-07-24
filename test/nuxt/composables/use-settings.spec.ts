import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('useSettings - securitySources', () => {
  beforeEach(() => {
    vi.resetModules()
    // settings persist to real localStorage in browser mode - clear between
    // tests so mutations from one test don't leak into the next
    localStorage.removeItem('npmx-settings')
  })

  it('defaults every security source to enabled', async () => {
    const { useSettings } = await import('~/composables/useSettings')
    const { settings } = useSettings()
    expect(settings.value.securitySources).toEqual({ osv: true })
  })

  describe('useSecuritySources composable', () => {
    it('setSourceEnabled updates the stored preference', async () => {
      const { useSettings, useSecuritySources } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const { setSourceEnabled } = useSecuritySources()

      setSourceEnabled('osv', false)
      expect(settings.value.securitySources.osv).toBe(false)

      setSourceEnabled('osv', true)
      expect(settings.value.securitySources.osv).toBe(true)
    })

    it('returns defaults before mount (SSR/hydration safety)', async () => {
      const { useSettings, useSecuritySources } = await import('~/composables/useSettings')
      const { settings } = useSettings()
      const { enabledSources, anySourceEnabled } = useSecuritySources()

      // Outside a mounted component, the useMounted() guard keeps the
      // defaults so the first client render matches the server render
      settings.value.securitySources.osv = false
      expect(enabledSources.value.osv).toBe(true)
      expect(anySourceEnabled.value).toBe(true)
    })

    it('reflects preference changes once mounted', async () => {
      const { mountSuspended } = await import('@nuxt/test-utils/runtime')
      const { defineComponent, nextTick } = await import('vue')
      const { useSettings, useSecuritySources } = await import('~/composables/useSettings')

      const wrapper = await mountSuspended(
        defineComponent({
          setup() {
            const { anySourceEnabled } = useSecuritySources()
            return { anySourceEnabled }
          },
          template: '<div>{{ anySourceEnabled }}</div>',
        }),
      )

      const { settings } = useSettings()

      settings.value.securitySources.osv = true
      await nextTick()
      expect(wrapper.text()).toBe('true')

      settings.value.securitySources.osv = false
      await nextTick()
      expect(wrapper.text()).toBe('false')
    })
  })
})
