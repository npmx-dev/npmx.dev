import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref, type EffectScope } from 'vue'
import type { DirectDependencyHealthResult } from '#shared/types/dependency-analysis'
import { DIRECT_DEPS_HEALTH_MAX } from '#shared/utils/constants'
import { useDirectDependencyHealth } from '~/composables/npm/useDirectDependencyHealth'

const EMPTY_HEALTH: DirectDependencyHealthResult = {
  vulnerable: {},
  deprecated: {},
}

describe('useDirectDependencyHealth', () => {
  let scope: EffectScope
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scope = effectScope()
    fetchMock = vi.fn().mockResolvedValue(EMPTY_HEALTH)
    vi.stubGlobal('$fetch', fetchMock)
  })

  afterEach(() => {
    scope.stop()
    vi.unstubAllGlobals()
  })

  it('loads dependencies in display-order batches', async () => {
    const names = Array.from({ length: DIRECT_DEPS_HEALTH_MAX + 10 }, (_, index) => `pkg-${index}`)
    const dependencies = Object.fromEntries(names.map(name => [name, '^1.0.0']))
    const result = scope.run(() => useDirectDependencyHealth(dependencies, names))!

    await result.requestHealth(names[0]!)

    const firstBatch = fetchMock.mock.calls[0]?.[1]?.body.dependencies
    expect(Object.keys(firstBatch)).toEqual(names.slice(0, DIRECT_DEPS_HEALTH_MAX))

    await result.requestHealth(names[1]!)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await result.requestHealth(names[DIRECT_DEPS_HEALTH_MAX]!)
    const secondBatch = fetchMock.mock.calls[1]?.[1]?.body.dependencies
    expect(Object.keys(secondBatch)).toEqual(names.slice(DIRECT_DEPS_HEALTH_MAX))
  })

  it('does not let a stale failed request clear current settled state', async () => {
    let rejectStaleRequest!: (reason: Error) => void
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectStaleRequest = reject
          }),
      )
      .mockResolvedValueOnce(EMPTY_HEALTH)

    const dependencies = ref({ pkg: '^1.0.0' })
    const result = scope.run(() => useDirectDependencyHealth(dependencies, ['pkg']))!
    const staleRequest = result.requestHealth('pkg')

    dependencies.value = { pkg: '^2.0.0' }
    await nextTick()
    await result.requestHealth('pkg')

    rejectStaleRequest(new Error('stale request failed'))
    await staleRequest
    await result.requestHealth('pkg')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
