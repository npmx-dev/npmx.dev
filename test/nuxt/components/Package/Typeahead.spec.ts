import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PackageTypeahead from '~/components/Package/Typeahead.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PackageTypeahead, {
    props: { inputId: 'typeahead-test', label: 'Search', ...props },
  })

type Wrapper = Awaited<ReturnType<typeof mount>>

// Results can't be picked until the search for what's typed has landed
async function search(component: Wrapper, text: string) {
  const input = component.find('input')
  await input.trigger('focus')
  await input.setValue(text)
  await vi.waitFor(() => {
    expect(component.findAll('[role="option"]').length).toBeGreaterThan(0)
    expect(component.find('[role="option"][aria-disabled]').exists()).toBe(false)
  })
  return input
}

describe('PackageTypeahead', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      objects: [
        { package: { name: 'zod', description: 'TypeScript-first schema validation' } },
        { package: { name: 'valibot', description: 'Modular schema library' } },
      ],
      total: 2,
      time: new Date().toISOString(),
    })
  })

  it('emits submit with an exact match flag when nothing is highlighted', async () => {
    const component = await mount()
    const input = component.find('input')
    await input.setValue('zod')
    await input.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() => expect(component.emitted('submit')).toEqual([['zod', true]]))

    mockFetch.mockResolvedValue({ objects: [], total: 0, time: new Date().toISOString() })
    await input.setValue('https://npmx.dev/collections/a/b')
    await input.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() =>
      expect(component.emitted('submit')?.[1]).toEqual(['https://npmx.dev/collections/a/b', false]),
    )
  })

  it('emits select for the highlighted result, skipping excluded names', async () => {
    const component = await mount({ exclude: ['zod'] })
    const input = await search(component, 'schema')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(component.emitted('select')).toEqual([['valibot']])
  })

  it('navigates options even with keyboard shortcuts disabled', async () => {
    const { settings } = useSettings()
    settings.value.keyboardShortcuts = false
    const component = await mount()
    const input = await search(component, 'schema')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    settings.value.keyboardShortcuts = true

    expect(component.emitted('select')).toEqual([['zod']])
  })

  it('puts leading options before results', async () => {
    const component = await mount({ leadingOptions: [{ value: 'special', label: 'Special' }] })
    const input = await search(component, 'schema')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(component.emitted('select')).toEqual([['special']])
  })

  it("doesn't pick the previous query's results while the next one loads", async () => {
    const component = await mount()
    const input = await search(component, 'schema')

    let resolveNext!: (value: unknown) => void
    mockFetch.mockReturnValue(new Promise(resolve => (resolveNext = resolve)))
    await input.setValue('vue')
    expect(component.find('[role="option"][aria-disabled]').exists()).toBe(true)
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    await component.findAll('[role="option"]')[0]!.trigger('click')
    expect(component.emitted('select')).toBeUndefined()

    resolveNext({
      objects: [{ package: { name: 'vue', description: 'The progressive framework' } }],
      total: 1,
      time: new Date().toISOString(),
    })
    await vi.waitFor(() =>
      expect(component.find('[role="option"][aria-disabled]').exists()).toBe(false),
    )
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })
    expect(component.emitted('select')).toEqual([['vue']])
  })

  it('leaves keys to an IME while it is composing', async () => {
    const component = await mount()
    const input = await search(component, 'schema')
    await input.trigger('keydown', { key: 'ArrowDown', isComposing: true })
    await input.trigger('keydown', { key: 'Enter', isComposing: true })

    expect(component.find('input').attributes('aria-activedescendant')).toBeUndefined()
    expect(component.emitted('select')).toBeUndefined()
    expect(component.emitted('submit')).toBeUndefined()
  })
})
