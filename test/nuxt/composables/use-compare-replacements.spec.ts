import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { ModuleReplacement, SimpleModuleReplacement } from 'module-replacements'
import type { ReplacementSuggestion } from '~/composables/useCompareReplacements'

/**
 * Helper to test useCompareReplacements by wrapping it in a component.
 */
async function useCompareReplacementsInComponent(
  packageNames: Parameters<typeof useCompareReplacements>[0],
) {
  const capturedNoDepSuggestions = ref<ReplacementSuggestion[]>([])
  const capturedInfoSuggestions = ref<ReplacementSuggestion[]>([])
  const capturedLoading = ref(false)
  const capturedReplacements = ref(new Map<string, ModuleReplacement | null>())

  const WrapperComponent = defineComponent({
    setup() {
      const { noDepSuggestions, infoSuggestions, loading, replacements } =
        useCompareReplacements(packageNames)

      watchEffect(() => {
        capturedNoDepSuggestions.value = [...noDepSuggestions.value]
        capturedInfoSuggestions.value = [...infoSuggestions.value]
        capturedLoading.value = loading.value
        capturedReplacements.value = new Map(replacements.value)
      })

      return () => h('div')
    },
  })

  await mountSuspended(WrapperComponent)

  return {
    noDepSuggestions: capturedNoDepSuggestions,
    infoSuggestions: capturedInfoSuggestions,
    loading: capturedLoading,
    replacements: capturedReplacements,
  }
}

describe('useCompareReplacements', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('suggestion categorization', () => {
    it('categorizes native replacements as no dep suggestions', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/replacements/array-includes')) {
            return Promise.resolve({
              mapping: { replacements: ['Array.prototype.includes'] },
              replacement: {
                id: 'Array.prototype.includes',
                type: 'native',
                url: {
                  type: 'mdn',
                  id: 'Web/JavaScript/Reference/Global_Objects/Array/includes',
                },
                webFeatureId: {
                  featureId: 'array-includes',
                  compatKey: 'javascript.builtins.Array.includes',
                },
                engines: [{ engine: 'nodejs', minVersion: '6.0.0' }],
              } satisfies ModuleReplacement,
            })
          }
          return Promise.resolve(null)
        }),
      )

      const { noDepSuggestions, infoSuggestions } = await useCompareReplacementsInComponent([
        'array-includes',
      ])

      await vi.waitFor(() => {
        expect(noDepSuggestions.value).toHaveLength(1)
      })

      expect(noDepSuggestions.value[0]?.forPackage).toBe('array-includes')
      expect(noDepSuggestions.value[0]?.replacement.type).toBe('native')
      expect(infoSuggestions.value).toHaveLength(0)
    })

    it('categorizes simple replacements as no dep suggestions', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/replacements/is-even')) {
            return Promise.resolve({
              mapping: { replacements: ['snippet::is-even'] },
              replacement: {
                id: 'snippet::is-even',
                type: 'simple',
                description: 'You can use the modulo operator to check if a number is even.',
                example: '(n % 2) === 0',
              } satisfies SimpleModuleReplacement,
            })
          }
          return Promise.resolve(null)
        }),
      )

      const { noDepSuggestions } = await useCompareReplacementsInComponent(['is-even'])

      await vi.waitFor(() => {
        expect(noDepSuggestions.value).toHaveLength(1)
      })

      expect(noDepSuggestions.value[0]?.forPackage).toBe('is-even')
      expect(noDepSuggestions.value[0]?.replacement.type).toBe('simple')
      expect(noDepSuggestions.value[0]?.replacement).toHaveProperty('example', '(n % 2) === 0')
    })

    it('categorizes documented replacements as info suggestions', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/replacements/moment')) {
            return Promise.resolve({
              mapping: { replacements: ['date-fns'] },
              replacement: {
                id: 'date-fns',
                type: 'documented',
                url: { type: 'e18e', id: 'moment' },
                replacementModule: 'date-fns',
              } satisfies ModuleReplacement,
            })
          }
          return Promise.resolve(null)
        }),
      )

      const { noDepSuggestions, infoSuggestions } = await useCompareReplacementsInComponent([
        'moment',
      ])

      await vi.waitFor(() => {
        expect(infoSuggestions.value).toHaveLength(1)
      })

      expect(infoSuggestions.value[0]?.forPackage).toBe('moment')
      expect(infoSuggestions.value[0]?.replacement.type).toBe('documented')
      expect(noDepSuggestions.value).toHaveLength(0)
    })

    it('correctly splits multiple packages into no dep and info categories', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/replacements/is-odd')) {
            return Promise.resolve({
              mapping: { replacements: ['snippet::is-odd'] },
              replacement: {
                id: 'snippet::is-odd',
                type: 'simple',
                description: 'Check if odd',
                example: '(n % 2) !== 0',
              } satisfies ModuleReplacement,
            })
          }
          if (url.includes('/api/replacements/lodash')) {
            return Promise.resolve({
              mapping: { replacements: ['native'] },
              replacement: {
                id: 'native',
                type: 'documented',
                url: { type: 'e18e', id: 'lodash' },
                replacementModule: 'native',
              } satisfies ModuleReplacement,
            })
          }
          if (url.includes('/api/replacements/array-map')) {
            return Promise.resolve({
              mapping: { replacements: ['Array.prototype.map'] },
              replacement: {
                id: 'Array.prototype.map',
                type: 'native',
                url: {
                  type: 'mdn',
                  id: 'Web/JavaScript/Reference/Global_Objects/Array/map',
                },
                engines: [{ engine: 'nodejs', minVersion: '0.10.0' }],
              } satisfies ModuleReplacement,
            })
          }
          return Promise.resolve(null)
        }),
      )

      const { noDepSuggestions, infoSuggestions } = await useCompareReplacementsInComponent([
        'is-odd',
        'lodash',
        'array-map',
      ])

      await vi.waitFor(() => {
        expect(noDepSuggestions.value).toHaveLength(2)
        expect(infoSuggestions.value).toHaveLength(1)
      })

      const noDepTypes = noDepSuggestions.value.map(s => s.replacement.type)
      expect(noDepTypes).toContain('simple')
      expect(noDepTypes).toContain('native')
      expect(infoSuggestions.value[0]?.replacement.type).toBe('documented')
    })
  })

  describe('packages without replacements', () => {
    it('does not include packages with no replacement data', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockImplementation(() => Promise.resolve(null)),
      )

      const { noDepSuggestions, infoSuggestions, replacements } =
        await useCompareReplacementsInComponent(['react'])

      await vi.waitFor(() => {
        expect(replacements.value.has('react')).toBe(true)
      })

      expect(noDepSuggestions.value).toHaveLength(0)
      expect(infoSuggestions.value).toHaveLength(0)
    })

    it('handles fetch errors gracefully', async () => {
      const fetchMock = vi.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network error'))
      })

      vi.stubGlobal('$fetch', fetchMock)

      const { noDepSuggestions, infoSuggestions, replacements } =
        await useCompareReplacementsInComponent(['some-package'])

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })

      expect(replacements.value.has('some-package')).toBe(false)
      expect(noDepSuggestions.value).toHaveLength(0)
      expect(infoSuggestions.value).toHaveLength(0)
    })
  })

  describe('caching', () => {
    it('retries a package after a transient fetch failure', async () => {
      const packageNames = ref(['is-even'])
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          mapping: { replacements: ['snippet::is-even'] },
          replacement: {
            id: 'snippet::is-even',
            type: 'simple',
            description: 'You can use the modulo operator to check if a number is even.',
            example: '(n % 2) === 0',
          } satisfies SimpleModuleReplacement,
        })

      vi.stubGlobal('$fetch', fetchMock)

      const { noDepSuggestions, replacements } =
        await useCompareReplacementsInComponent(packageNames)

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })

      expect(replacements.value.has('is-even')).toBe(false)

      packageNames.value = []
      await nextTick()
      packageNames.value = ['is-even']

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(noDepSuggestions.value).toHaveLength(1)
      })

      expect(replacements.value.get('is-even')?.type).toBe('simple')
    })

    it('caches successful null replacement data and does not refetch', async () => {
      const fetchMock = vi.fn().mockResolvedValue(null)

      vi.stubGlobal('$fetch', fetchMock)

      const packageNames = ref(['react'])
      const { replacements } = await useCompareReplacementsInComponent(packageNames)

      await vi.waitFor(() => {
        expect(replacements.value.has('react')).toBe(true)
      })

      packageNames.value = []
      await nextTick()
      packageNames.value = ['react']

      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1)
      })
    })

    it('caches replacement data and does not refetch', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/replacements/is-even')) {
          return Promise.resolve({
            mapping: { replacements: ['snippet::is-even'] },
            replacement: {
              id: 'snippet::is-even',
              type: 'simple',
              description: 'Check even',
              example: '(n % 2) === 0',
            } satisfies SimpleModuleReplacement,
          })
        }
        return Promise.resolve(null)
      })

      vi.stubGlobal('$fetch', fetchMock)

      const { noDepSuggestions } = await useCompareReplacementsInComponent(['is-even'])

      await vi.waitFor(() => {
        expect(noDepSuggestions.value).toHaveLength(1)
      })

      // Check that fetch was called exactly once for is-even
      const isEvenCalls = fetchMock.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('is-even'),
      )
      expect(isEvenCalls).toHaveLength(1)
    })
  })
})
