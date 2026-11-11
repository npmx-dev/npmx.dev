import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PackageTypeahead from '~/components/Package/Typeahead.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

const mount = (props: Record<string, unknown> = {}) =>
  mountSuspended(PackageTypeahead, {
    props: { inputId: 'typeahead-test', label: 'Search', ...props },
  })

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
    const input = component.find('input')
    await input.setValue('schema')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(component.emitted('select')).toEqual([['valibot']])
  })

  it('puts leading options before results', async () => {
    const component = await mount({ leadingOptions: [{ value: 'special', label: 'Special' }] })
    const input = component.find('input')
    await input.setValue('schema')
    await input.trigger('keydown', { key: 'ArrowDown' })
    await input.trigger('keydown', { key: 'Enter' })

    expect(component.emitted('select')).toEqual([['special']])
  })
})
