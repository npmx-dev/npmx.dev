import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { ModuleReplacement } from 'module-replacements'

const SIMPLE_REPLACEMENT: ModuleReplacement = {
  type: 'simple',
  moduleName: 'is-even',
  replacement: 'Use (n % 2) === 0',
  category: 'micro-utilities',
}

const NATIVE_REPLACEMENT: ModuleReplacement = {
  type: 'native',
  moduleName: 'array-includes',
  nodeVersion: '6.0.0',
  replacement: 'Array.prototype.includes',
  mdnPath: 'Global_Objects/Array/includes',
  category: 'native',
}

async function mountWithDeps(deps: Record<string, string> | undefined) {
  const captured = ref<Record<string, ModuleReplacement>>({})

  const WrapperComponent = defineComponent({
    setup() {
      const replacements = useReplacementDependencies(() => deps)

      watchEffect(() => {
        captured.value = { ...replacements.value }
      })

      return () => h('div')
    },
  })

  await mountSuspended(WrapperComponent)

  return captured
}

describe('useReplacementDependencies', () => {
  it('returns replacements for dependencies that have them', async () => {
    registerEndpoint('/api/replacements/is-even', () => SIMPLE_REPLACEMENT)
    registerEndpoint('/api/replacements/picoquery', () => null)

    const replacements = await mountWithDeps({
      'is-even': '^1.0.0',
      'picoquery': '^1.0.0',
    })

    await vi.waitFor(() => {
      expect(replacements.value['is-even']).toBeDefined()
    })

    expect(replacements.value['is-even']?.type).toBe('simple')
    expect(replacements.value['picoquery']).toBeUndefined()
  })

  it('returns empty object for undefined dependencies', async () => {
    const replacements = await mountWithDeps(undefined)

    await vi.waitFor(() => {
      expect(replacements.value).toEqual({})
    })
  })

  it('returns empty object for empty dependencies', async () => {
    const replacements = await mountWithDeps({})

    await vi.waitFor(() => {
      expect(replacements.value).toEqual({})
    })
  })

  it('handles multiple dependencies with replacements', async () => {
    registerEndpoint('/api/replacements/is-even', () => SIMPLE_REPLACEMENT)
    registerEndpoint('/api/replacements/array-includes', () => NATIVE_REPLACEMENT)
    registerEndpoint('/api/replacements/picoquery', () => null)

    const replacements = await mountWithDeps({
      'is-even': '^1.0.0',
      'array-includes': '^3.0.0',
      'picoquery': '^1.0.0',
    })

    await vi.waitFor(() => {
      expect(Object.keys(replacements.value)).toHaveLength(2)
    })

    expect(replacements.value['is-even']?.type).toBe('simple')
    expect(replacements.value['array-includes']?.type).toBe('native')
    expect(replacements.value['picoquery']).toBeUndefined()
  })

  it('handles fetch errors gracefully', async () => {
    registerEndpoint('/api/replacements/failing-package', () => {
      throw new Error('Network error')
    })
    registerEndpoint('/api/replacements/is-even', () => SIMPLE_REPLACEMENT)

    const replacements = await mountWithDeps({
      'failing-package': '^1.0.0',
      'is-even': '^1.0.0',
    })

    await vi.waitFor(() => {
      expect(replacements.value['is-even']).toBeDefined()
    })

    expect(replacements.value['failing-package']).toBeUndefined()
    expect(replacements.value['is-even']?.type).toBe('simple')
  })
})
