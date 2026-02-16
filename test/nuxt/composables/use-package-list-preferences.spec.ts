import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, onMounted } from 'vue'
import { mount } from '@vue/test-utils'
import { usePackageListPreferences } from '../../../app/composables/usePackageListPreferences'
import { DEFAULT_PREFERENCES } from '../../../shared/types/preferences'

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

function setLocalStorage(stored: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

describe('usePackageListPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes with default values when storage is empty', () => {
    mountWithSetup(() => {
      const { preferences } = usePackageListPreferences()
      onMounted(() => {
        expect(preferences.value).toEqual(DEFAULT_PREFERENCES)
      })
    })
  })

  it('loads and merges values from localStorage', () => {
    mountWithSetup(() => {
      const stored = { viewMode: 'table' }
      setLocalStorage(stored)
      const { preferences } = usePackageListPreferences()
      onMounted(() => {
        expect(preferences.value.viewMode).toBe('table')
        expect(preferences.value.paginationMode).toBe(DEFAULT_PREFERENCES.paginationMode)
        expect(preferences.value.pageSize).toBe(DEFAULT_PREFERENCES.pageSize)
        expect(preferences.value.columns).toEqual(DEFAULT_PREFERENCES.columns)
      })
    })
  })

  it('handles array merging by replacement', () => {
    mountWithSetup(() => {
      const stored = { columns: [] }
      setLocalStorage(stored)
      const { preferences } = usePackageListPreferences()
      onMounted(() => {
        expect(preferences.value.columns).toEqual([])
      })
    })
  })
})
