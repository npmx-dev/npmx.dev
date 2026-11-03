import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import AuthHandleCombobox from '~/components/Header/AuthHandleCombobox.client.vue'
import { useSettings } from '~/composables/useSettings'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

// Must stay above the composable's 300ms debounce.
const SEARCH_SETTLE_MS = 450

const ACTORS = [
  {
    did: 'did:plc:alice',
    handle: 'alice.npmx.social',
    displayName: 'Alice',
    // A real, loadable image so the avatar is still in the DOM when assertions run.
    avatar: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
  },
  { did: 'did:plc:bob', handle: 'bob.bsky.social', displayName: 'Bob' },
]

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Let the debounce timer fire and the resolved request render. */
async function flushSearch() {
  await wait(SEARCH_SETTLE_MS)
  await flushPromises()
}

async function mountCombobox(modelValue = '') {
  return mountSuspended(AuthHandleCombobox, { props: { modelValue, label: 'Handle' } })
}

describe('AuthHandleCombobox', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ actors: ACTORS })
  })

  it('does not search until the query is long enough', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('a')
    await wait(SEARCH_SETTLE_MS)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('sends the X-Client header so usage is attributed to npmx.dev', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('ali')
    await flushSearch()

    expect(mockFetch).toHaveBeenCalled()
    const [, options] = mockFetch.mock.calls[0]!
    expect(options.headers).toEqual({ 'X-Client': 'npmx.dev' })
  })

  it('debounces rapid typing into a single request', async () => {
    const component = await mountCombobox()
    const input = component.find('input')
    await input.setValue('al')
    await wait(100)
    await input.setValue('ali')
    await wait(100)
    await input.setValue('alic')
    await flushSearch()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0]![1].query).toMatchObject({ q: 'alic' })
  })

  it('does not search for PDS URLs', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('https://npmx.social')
    await wait(SEARCH_SETTLE_MS)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('renders results with display name and handle', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')

    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    const options = component.findAll('[role="option"]')
    expect(options[0]!.text()).toContain('Alice')
    expect(options[0]!.text()).toContain('@alice.npmx.social')
    expect(component.find('[role="listbox"]').exists()).toBe(true)
  })

  it('exposes combobox semantics on the input', async () => {
    const component = await mountCombobox()
    const input = component.find('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-autocomplete')).toBe('list')
    expect(input.attributes('aria-expanded')).toBe('false')

    await input.setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.find('input').attributes('aria-expanded')).toBe('true'))
  })

  it('tracks the highlighted option via aria-activedescendant', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    await component.find('input').trigger('keydown', { key: 'ArrowDown' })
    const first = component.findAll('[role="option"]')[0]!
    expect(component.find('input').attributes('aria-activedescendant')).toBe(first.attributes('id'))
    expect(first.attributes('aria-selected')).toBe('true')
  })

  it('selects the highlighted account with Enter and fills the input', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    await component.find('input').trigger('keydown', { key: 'ArrowDown' })
    await component.find('input').trigger('keydown', { key: 'Enter' })

    expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['alice.npmx.social'])
    expect(component.find('[role="listbox"]').exists()).toBe(false)
  })

  it('fills the input when a result is clicked', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    await component.findAll('[role="option"]')[1]!.trigger('click')
    expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['bob.bsky.social'])
  })

  it('closes the list on Escape without changing the value', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    component.find('input').element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => expect(component.find('[role="listbox"]').exists()).toBe(false))
    // Only the typed value was emitted; Escape must not select a suggestion.
    expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['al'])
  })

  it('shows an empty state when nothing matches', async () => {
    mockFetch.mockResolvedValue({ actors: [] })
    const component = await mountCombobox()
    await component.find('input').setValue('zzz')
    await flushSearch()

    await vi.waitFor(() => expect(component.find('[role="status"]').exists()).toBe(true))
    expect(component.find('[role="status"]').text()).toContain('No accounts found')
  })

  it('shows unavailable state instead of throwing when the API fails', async () => {
    mockFetch.mockRejectedValue(new Error('503'))
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()

    await vi.waitFor(
      () => {
        const status = component.find('[role="status"]')
        expect(status.exists()).toBe(true)
        expect(status.text()).toContain('unavailable')
      },
      { timeout: 2000 },
    )
    expect(component.find('[role="option"]').exists()).toBe(false)
  })

  it('keeps debouncing keystrokes while a request is in flight', async () => {
    // Behave like a real fetch: stay pending until resolved, reject when aborted.
    const resolvers: Array<(value: unknown) => void> = []
    mockFetch.mockImplementation(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((resolve, reject) => {
          resolvers.push(resolve)
          options.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const component = await mountCombobox()
    const input = component.find('input')
    await input.setValue('al')
    await flushSearch()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // The first request is still pending; keep typing faster than the debounce.
    await input.setValue('ali')
    await wait(100)
    await input.setValue('alic')
    await wait(100)
    await input.setValue('alice')
    await flushSearch()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1]![1].query).toMatchObject({ q: 'alice' })
    for (const resolve of resolvers) resolve({ actors: [] })
  })

  it('serves cached results immediately when a query is repeated', async () => {
    mockFetch
      .mockResolvedValueOnce({ actors: ACTORS })
      .mockResolvedValueOnce({ actors: [ACTORS[1]] })
    const component = await mountCombobox()
    const input = component.find('input')
    await input.setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))
    await input.setValue('bo')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(1))

    await input.setValue('al')
    // No debounce wait: the cached answer should already be rendered.
    expect(component.findAll('[role="option"]')).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('clears stale results while a new query is pending', async () => {
    const component = await mountCombobox()
    const input = component.find('input')
    await input.setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    await input.setValue('bo')
    expect(component.findAll('[role="option"]')).toHaveLength(0)
    expect(component.find('[role="status"]').text()).toContain('Searching')
  })

  it('wraps to the last option when ArrowUp is pressed with nothing highlighted', async () => {
    const component = await mountCombobox()
    const input = component.find('input')
    await input.setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    await input.trigger('keydown', { key: 'ArrowUp' })
    const last = component.findAll('[role="option"]').at(-1)!
    expect(input.attributes('aria-activedescendant')).toBe(last.attributes('id'))
  })

  it('handles combobox keys even when keyboard shortcuts are disabled', async () => {
    const { settings } = useSettings()
    settings.value.keyboardShortcuts = false
    try {
      const component = await mountCombobox()
      const input = component.find('input')
      await input.setValue('al')
      await flushSearch()
      await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

      await input.trigger('keydown', { key: 'ArrowDown' })
      const first = component.findAll('[role="option"]')[0]!
      expect(input.attributes('aria-activedescendant')).toBe(first.attributes('id'))

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      input.element.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(component.find('[role="listbox"]').exists()).toBe(false))
    } finally {
      settings.value.keyboardShortcuts = true
    }
  })

  it('does not advertise a listbox while only a status message is shown', async () => {
    mockFetch.mockResolvedValue({ actors: [] })
    const component = await mountCombobox()
    await component.find('input').setValue('zzz')
    await flushSearch()
    await vi.waitFor(() => expect(component.find('[role="status"]').exists()).toBe(true))

    const input = component.find('input')
    expect(input.attributes('aria-expanded')).toBe('false')
    expect(input.attributes('aria-controls')).toBeUndefined()
  })

  it('renders avatars as decorative images so names are not read twice', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    const img = component.findAll('[role="option"]')[0]!.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('alt')).toBe('')
  })

  it('falls back to initials when an avatar fails to load', async () => {
    const component = await mountCombobox()
    await component.find('input').setValue('al')
    await flushSearch()
    await vi.waitFor(() => expect(component.findAll('[role="option"]')).toHaveLength(2))

    const option = component.findAll('[role="option"]')[0]!
    await option.find('img').trigger('error')
    expect(option.find('img').exists()).toBe(false)
    expect(option.find('span[aria-hidden="true"]').text()).toBe('A')
  })
})
