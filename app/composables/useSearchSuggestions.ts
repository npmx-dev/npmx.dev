import { debounce } from 'perfect-debounce'

const SUGGESTIONS_DEBOUNCE_MS = 140
const SUGGESTIONS_LIMIT = 8

export interface SearchSuggestionOption {
  id: string
  kind: 'package' | 'search'
  label: string
}

/**
 * Package-name suggestions for a search input.
 * Only active while instant search is off: with it on, typing already shows the results.
 */
export function useSearchSuggestions({
  id,
  query,
  onSearch,
}: {
  id: string
  query: Ref<string>
  onSearch: () => void
}) {
  const { settings } = useSettings()
  // Gate on mount so the SSR markup (rendered with default settings) hydrates cleanly
  const mounted = useMounted()
  const enabled = computed(() => mounted.value && !settings.value.instantSearch)

  const listId = `${id}-suggestions`
  const trimmed = computed(() => query.value.trim())
  const suggestions = shallowRef<string[]>([])
  const pending = shallowRef(false)
  const open = shallowRef(false)
  const active = shallowRef(-1)

  const fetchSuggestions = debounce(async (q: string) => {
    const names = await $fetch<[string, string[]]>('/api/opensearch/suggestions', { query: { q } })
      .then(([, list]) => list.slice(0, SUGGESTIONS_LIMIT))
      .catch(() => [])
    if (trimmed.value !== q) return
    suggestions.value = names
    pending.value = false
  }, SUGGESTIONS_DEBOUNCE_MS)

  watch([trimmed, enabled], ([q, isEnabled]) => {
    if (!q || !isEnabled) {
      fetchSuggestions.cancel()
      suggestions.value = []
      pending.value = false
      return
    }
    pending.value = true
    fetchSuggestions(q)
  })

  const options = computed<SearchSuggestionOption[]>(() => {
    if (!enabled.value || !trimmed.value) return []
    return [
      ...suggestions.value.map((name, i) => ({
        id: `${listId}-${i}`,
        kind: 'package' as const,
        label: name,
      })),
      { id: `${listId}-all`, kind: 'search', label: trimmed.value },
    ]
  })

  const expanded = computed(() => open.value && options.value.length > 0)
  const activeOption = computed(() => (expanded.value ? options.value[active.value] : undefined))

  // Preselect an exact name match so Enter opens that package directly
  watch([trimmed, suggestions], () => {
    active.value = suggestions.value.indexOf(trimmed.value.toLowerCase())
  })

  watch(active, index => {
    const optionId = options.value[index]?.id
    if (optionId)
      nextTick(() => document.getElementById(optionId)?.scrollIntoView({ block: 'nearest' }))
  })

  function close() {
    open.value = false
    active.value = -1
  }

  function choose(option?: SearchSuggestionOption) {
    close()
    if (option?.kind === 'package') {
      query.value = ''
      navigateTo(packageRoute(option.label))
    } else {
      onSearch()
    }
  }

  function submit() {
    choose(activeOption.value)
  }

  function move(step: 1 | -1) {
    open.value = true
    const total = options.value.length
    if (!total) return
    active.value = active.value < 0 && step < 0 ? total - 1 : (active.value + step + total) % total
  }

  function onKeydown(e: KeyboardEvent) {
    if (!enabled.value || e.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      move(e.key === 'ArrowDown' ? 1 : -1)
    } else if (e.key === 'Escape' && expanded.value) {
      e.preventDefault()
      close()
    }
  }

  const inputProps = computed(() => ({
    ...(enabled.value && {
      'role': 'combobox',
      'aria-autocomplete': 'list' as const,
      'aria-haspopup': 'listbox' as const,
      'aria-controls': listId,
      'aria-expanded': expanded.value,
      'aria-activedescendant': activeOption.value?.id,
    }),
    onInput: () => {
      open.value = true
    },
    onFocus: () => {
      open.value = suggestions.value.length > 0
    },
    onBlur: close,
    onKeydown,
  }))

  return {
    listId,
    query: trimmed,
    pending,
    options,
    expanded,
    active,
    inputProps,
    choose,
    submit,
  }
}
