import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { usePreferencesProvider } from '../../../app/composables/usePreferencesProvider'

const STORAGE_KEY = 'npmx-list-prefs'

function mountWithSetup(run: () => void) {
  return mount(
    defineComponent({
      name: 'TestHarness',
      setup() {
        run()
        return () => null
      },
    }),
    { attachTo: document.body },
  )
}

function setLocalStorage(stored: Record<string, any>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

describe('usePreferencesProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default values when storage is empty', () => {
    mountWithSetup(() => {
      const defaults = { theme: 'light', cols: ['name', 'version'] }
      const { data } = usePreferencesProvider(defaults)
      onMounted(() => {
        expect(data.value).toEqual(defaults)
      })
    })
  })

  it('loads values from localStorage', () => {
    mountWithSetup(() => {
      const defaults = { theme: 'light' }
      const stored = { theme: 'dark' }
      setLocalStorage(stored)
      const { data } = usePreferencesProvider(defaults)
      onMounted(() => {
        expect(data.value).toEqual(stored)
      })
    })
  })

  it('handles array merging by replacement (preventing duplicates)', () => {
    mountWithSetup(() => {
      const defaults = { cols: ['name', 'version', 'date'] }
      const stored = { cols: ['name', 'version'] }
      setLocalStorage(stored)
      const { data } = usePreferencesProvider(defaults)
      onMounted(() => {
        expect(data.value.cols).toEqual(['name', 'version'])
      })
    })
  })
})
