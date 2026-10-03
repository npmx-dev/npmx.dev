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
    const dependencies = Object.fromEntries(names.map(name => [name, { name, version: '^1.0.0' }]))
    const result = scope.run(() => useDirectDependencyHealth(dependencies, names))!

    await result.requestHealth(names[0]!)

    const firstBatch = fetchMock.mock.calls[0]?.[1]?.body.dependencies
    expect(Object.keys(firstBatch)).toEqual(names.slice(0, DIRECT_DEPS_HEALTH_MAX))
    expect(Object.values(firstBatch).every(v => typeof v === 'string')).toBe(true)

    await result.requestHealth(names[1]!)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await result.requestHealth(names[DIRECT_DEPS_HEALTH_MAX]!)
    const secondBatch = fetchMock.mock.calls[1]?.[1]?.body.dependencies
    expect(Object.keys(secondBatch)).toEqual(names.slice(DIRECT_DEPS_HEALTH_MAX))
    expect(Object.values(secondBatch).every(v => typeof v === 'string')).toBe(true)
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

    const dependencies = ref({ pkg: { name: 'pkg', version: '^1.0.0' } })
    const result = scope.run(() => useDirectDependencyHealth(dependencies, ['pkg']))!
    const staleRequest = result.requestHealth('pkg')

    dependencies.value = { pkg: { name: 'pkg', version: '^2.0.0' } }
    await nextTick()
    await result.requestHealth('pkg')

    rejectStaleRequest(new Error('stale request failed'))
    await staleRequest
    await result.requestHealth('pkg')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sends target package name from DependencySpec.name for aliases and maps response back to original alias key', async () => {
    const dependencies = {
      'my-lodash': { name: 'lodash', version: '^4.17.21' },
      'express': { name: 'express', version: '^4.18.2' },
    }
    const names = ['my-lodash', 'express']

    const mockResponse: DirectDependencyHealthResult = {
      vulnerable: {
        lodash: {
          name: 'lodash',
          version: '4.17.21',
          counts: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 },
        },
      },
      deprecated: {
        express: {
          name: 'express',
          version: '4.18.2',
          message: 'Express is deprecated',
        },
      },
    }
    fetchMock.mockResolvedValueOnce(mockResponse)

    const result = scope.run(() => useDirectDependencyHealth(dependencies, names))!
    await result.requestHealth('my-lodash')

    const sentBatch = fetchMock.mock.calls[0]?.[1]?.body.dependencies
    expect(sentBatch).toEqual({
      lodash: '^4.17.21',
      express: '^4.18.2',
    })

    expect(result.health.value.vulnerable['my-lodash']).toEqual(mockResponse.vulnerable.lodash)
    expect(result.health.value.deprecated['express']).toEqual(mockResponse.deprecated.express)
  })

  it('preserves distinct results for aliases targeting different versions of the same package', async () => {
    const dependencies = {
      'lodash-v3': { name: 'lodash', version: '^3.10.1' },
      'lodash-v4': { name: 'lodash', version: '^4.17.21' },
    }
    const names = ['lodash-v3', 'lodash-v4']

    const mockResponse1: DirectDependencyHealthResult = {
      vulnerable: {
        lodash: {
          name: 'lodash',
          version: '3.10.1',
          counts: { total: 5, critical: 1, high: 2, moderate: 2, low: 0 },
        },
      },
      deprecated: {},
    }

    const mockResponse2: DirectDependencyHealthResult = {
      vulnerable: {
        lodash: {
          name: 'lodash',
          version: '4.17.21',
          counts: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 },
        },
      },
      deprecated: {},
    }

    fetchMock.mockResolvedValueOnce(mockResponse1).mockResolvedValueOnce(mockResponse2)

    const result = scope.run(() => useDirectDependencyHealth(dependencies, names))!

    await result.requestHealth('lodash-v3')

    expect(fetchMock.mock.calls[0]?.[1]?.body.dependencies).toEqual({ lodash: '^3.10.1' })
    expect(result.health.value.vulnerable['lodash-v3']).toEqual(mockResponse1.vulnerable.lodash)

    await result.requestHealth('lodash-v4')

    expect(fetchMock.mock.calls[1]?.[1]?.body.dependencies).toEqual({ lodash: '^4.17.21' })
    expect(result.health.value.vulnerable['lodash-v4']).toEqual(mockResponse2.vulnerable.lodash)
  })

  it('handles target package names matching prototype properties like constructor', async () => {
    const dependencies = {
      constructor: { name: 'constructor', version: '^1.0.0' },
    }
    const names = ['constructor']

    const mockResponse: DirectDependencyHealthResult = {
      vulnerable: {},
      deprecated: {},
    }
    fetchMock.mockResolvedValueOnce(mockResponse)

    const result = scope.run(() => useDirectDependencyHealth(dependencies, names))!
    await result.requestHealth('constructor')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.body.dependencies).toEqual({
      constructor: '^1.0.0',
    })
  })
})
