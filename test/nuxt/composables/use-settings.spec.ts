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

describe('useSettings - chartFilter', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should have correct default values', async () => {
    const { DEFAULT_CHART_FILTER } = await import('~/composables/useSettings')
    expect(DEFAULT_CHART_FILTER).toEqual({
      averageWindow: 0,
      smoothingTau: 0,
      anomaliesFixed: true,
      predictionPoints: 4,
    })
  })

  it('should report isDefault as true when all values match defaults', async () => {
    const { useChartFilter } = await import('~/composables/useSettings')
    const { isDefault } = useChartFilter()
    expect(isDefault.value).toBe(true)
  })

  it('should report isDefault as false when any value differs', async () => {
    const { useSettings, useChartFilter } = await import('~/composables/useSettings')
    const { settings } = useSettings()
    const { isDefault } = useChartFilter()

    settings.value.chartFilter.averageWindow = 5
    expect(isDefault.value).toBe(false)
  })

  it('should reset all values to defaults', async () => {
    const { useSettings, useChartFilter, DEFAULT_CHART_FILTER } =
      await import('~/composables/useSettings')
    const { settings } = useSettings()
    const { isDefault, reset } = useChartFilter()

    settings.value.chartFilter.averageWindow = 5
    settings.value.chartFilter.smoothingTau = 3
    settings.value.chartFilter.anomaliesFixed = false
    settings.value.chartFilter.predictionPoints = 10
    expect(isDefault.value).toBe(false)

    reset()
    expect(isDefault.value).toBe(true)
    expect(settings.value.chartFilter).toEqual(DEFAULT_CHART_FILTER)
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
