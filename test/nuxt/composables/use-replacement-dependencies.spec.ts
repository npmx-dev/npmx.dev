import { describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { ModuleReplacement } from 'module-replacements'

const SIMPLE_REPLACEMENT: ModuleReplacement = {
  id: 'snippet::is-even',
  type: 'simple',
  description: 'You can use the modulo operator to check if a number is even.',
  example: '(n % 2) === 0',
}

const NATIVE_REPLACEMENT: ModuleReplacement = {
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
  engines: [
    { engine: 'chrome', minVersion: '47' },
    { engine: 'chrome_android', minVersion: '47' },
    { engine: 'edge', minVersion: '14' },
    { engine: 'firefox', minVersion: '43' },
    { engine: 'firefox_android', minVersion: '43' },
    { engine: 'safari', minVersion: '9' },
    { engine: 'safari_ios', minVersion: '9' },
    { engine: 'bun', minVersion: '1.0.0' },
    { engine: 'deno', minVersion: '1.0' },
    { engine: 'nodejs', minVersion: '6.0.0' },
    { engine: 'oculus', minVersion: '5.0' },
    { engine: 'opera', minVersion: '34' },
    { engine: 'opera_android', minVersion: '34' },
    { engine: 'samsunginternet_android', minVersion: '5.0' },
    { engine: 'webview_android', minVersion: '47' },
    { engine: 'webview_ios', minVersion: '9' },
  ],
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

    const simple = replacements.value['is-even']
    const native = replacements.value['array-includes']

    expect(simple?.type).toBe('simple')
    expect(native?.type).toBe('native')
    expect(native?.url?.type).toBe('mdn')
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
