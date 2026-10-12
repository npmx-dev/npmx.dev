import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The sibling use-settings.spec.ts covers the key-less (unavailable) branch via
// the real runtime config; here we flip public.socketConfigured on to exercise
// the available branch, restoring it afterwards so the change can't leak.
describe('useSecuritySources - available Socket deployment', () => {
  let previous: boolean
  // test/nuxt runs in a real browser, so localStorage persists across tests -
  // restore whatever was there so this case can't corrupt another's settings
  let previousSettings: string | null = null

  beforeEach(() => {
    vi.resetModules()
    const runtimeConfig = useRuntimeConfig()
    previous = runtimeConfig.public.socketConfigured
    runtimeConfig.public.socketConfigured = true
    previousSettings = localStorage.getItem('npmx-settings')
    localStorage.removeItem('npmx-settings')
  })

  afterEach(() => {
    useRuntimeConfig().public.socketConfigured = previous
    if (previousSettings === null) {
      localStorage.removeItem('npmx-settings')
    } else {
      localStorage.setItem('npmx-settings', previousSettings)
    }
  })

  it('treats Socket as available and effective when the deployment has a key', async () => {
    const { useSecuritySources } = await import('~/composables/useSettings')
    const { sourceAvailability, effectiveSources } = useSecuritySources()

    expect(sourceAvailability.value.socket).toBe(true)
    // the default preference has Socket on, so an available deployment surfaces it
    expect(effectiveSources.value.socket).toBe(true)
  })
})
