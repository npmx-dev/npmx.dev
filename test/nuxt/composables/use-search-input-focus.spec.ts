import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { HeaderSearchBox } from '#components'

const notProvided = (): boolean => {
  throw new Error('focus function was not captured')
}

const Target = defineComponent({
  props: { id: { type: String, required: true } },
  setup(props) {
    const input = shallowRef<HTMLInputElement | null>(null)
    useSearchInputFocusTarget(() => {
      if (!input.value) return false
      input.value.focus()
      return true
    })
    return () => h('input', { id: props.id, ref: input, type: 'search' })
  },
})

async function mountProvider(children: () => ReturnType<typeof h>[], route?: string) {
  let focusSearchInput = notProvided
  const Provider = defineComponent({
    setup() {
      focusSearchInput = provideSearchInputFocus().focus
      return () => h('div', children())
    },
  })
  const wrapper = await mountSuspended(Provider, { attachTo: document.body, route })
  return { wrapper, focusSearchInput: () => focusSearchInput() }
}

describe('useSearchInputFocus', () => {
  it('focuses a registered search input', async () => {
    const { wrapper, focusSearchInput } = await mountProvider(() => [h(Target, { id: 'target' })])
    try {
      expect(focusSearchInput()).toBe(true)
      expect(document.activeElement?.id).toBe('target')
    } finally {
      wrapper.unmount()
    }
  })

  it('returns false when no search input is registered', async () => {
    const { wrapper, focusSearchInput } = await mountProvider(() => [])
    try {
      expect(focusSearchInput()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('skips targets that are not rendered and stops after the first success', async () => {
    const hidden = vi.fn(() => false)
    const HiddenTarget = defineComponent({
      setup() {
        useSearchInputFocusTarget(hidden)
        return () => null
      },
    })
    const focused = vi.fn(() => true)
    const FocusedTarget = defineComponent({
      setup() {
        useSearchInputFocusTarget(focused)
        return () => null
      },
    })
    const spare = vi.fn(() => true)
    const SpareTarget = defineComponent({
      setup() {
        useSearchInputFocusTarget(spare)
        return () => null
      },
    })
    const { wrapper, focusSearchInput } = await mountProvider(() => [
      h(HiddenTarget),
      h(FocusedTarget),
      h(SpareTarget),
    ])
    try {
      expect(focusSearchInput()).toBe(true)
      expect(hidden).toHaveBeenCalledTimes(1)
      expect(focused).toHaveBeenCalledTimes(1)
      expect(spare).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })

  it('unregisters a target when its component unmounts', async () => {
    const target = vi.fn(() => true)
    const StaleTarget = defineComponent({
      setup() {
        useSearchInputFocusTarget(target)
        return () => null
      },
    })
    const show = shallowRef(true)
    const { wrapper, focusSearchInput } = await mountProvider(() =>
      show.value ? [h(StaleTarget)] : [],
    )
    try {
      expect(focusSearchInput()).toBe(true)
      show.value = false
      await nextTick()
      expect(focusSearchInput()).toBe(false)
      expect(target).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  })

  it('uses the injected focus function when one is provided', async () => {
    let focusSearchInput = notProvided
    const Consumer = defineComponent({
      setup() {
        focusSearchInput = useSearchInputFocus()
        return () => null
      },
    })
    const { wrapper } = await mountProvider(() => [h(Target, { id: 'target' }), h(Consumer)])
    try {
      expect(focusSearchInput()).toBe(true)
      expect(document.activeElement?.id).toBe('target')
    } finally {
      wrapper.unmount()
    }
  })

  it('returns false without a provider', async () => {
    let focusSearchInput = notProvided
    const Consumer = defineComponent({
      setup() {
        focusSearchInput = useSearchInputFocus()
        return () => null
      },
    })
    const wrapper = await mountSuspended(Consumer)
    try {
      expect(focusSearchInput()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('registers the header search box and reports when its input is not rendered', async () => {
    const { wrapper, focusSearchInput } = await mountProvider(() => [h(HeaderSearchBox)], '/search')
    try {
      expect(focusSearchInput()).toBe(true)
      expect(document.activeElement?.id).toBe('header-search')

      // The header search box hides its input on the homepage
      await useRouter().push('/')
      await nextTick()
      expect(wrapper.find('#header-search').exists()).toBe(false)
      expect(focusSearchInput()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
