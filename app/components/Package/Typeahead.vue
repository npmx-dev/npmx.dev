<script setup lang="ts">
type TypeaheadOption = { value: string; label: string }

const query = defineModel<string>('query', { default: '' })

const props = defineProps<{
  inputId: string
  /** Accessible label; visually hidden */
  label: string
  placeholder?: string
  describedby?: string
  /** Package names to leave out of results, e.g. ones already chosen */
  exclude?: readonly string[]
  /** Shown above search results and navigable with them; content via the `option` slot */
  leadingOptions?: readonly TypeaheadOption[]
}>()

const emit = defineEmits<{
  /** A package (or leading option value) was picked from the list */
  select: [value: string]
  /** Enter with nothing highlighted; the parent decides what free text means */
  submit: [query: string, exactMatch: boolean]
}>()

defineSlots<{
  option?: (props: { option: TypeaheadOption }) => unknown
}>()

const isInputFocused = shallowRef(false)
const highlightedIndex = shallowRef(-1)
const listRef = useTemplateRef('listRef')
const PAGE_JUMP = 5

const { searchProvider } = useSearchProvider()
const { data: searchData, status } = useSearch(query, searchProvider, { size: 15 })
const isSearching = computed(() => status.value === 'pending')

const excluded = computed(() => new Set(props.exclude ?? []))
const leading = computed(() => props.leadingOptions ?? [])

const filteredResults = computed(() => {
  if (!searchData.value?.objects) return []
  return searchData.value.objects
    .map(o => ({ name: o.package.name, description: o.package.description }))
    .filter(r => !excluded.value.has(r.name))
})

const navigableValues = computed(() => [
  ...leading.value.map(o => o.value),
  ...filteredResults.value.map(r => r.name),
])

// A fast "zod⏎" shouldn't be judged against the previous query's results.
async function submitWhenSearched(text: string) {
  await nextTick()
  if (isSearching.value) {
    await new Promise<void>(resolve => {
      const stop = watch(isSearching, searching => {
        if (searching) return
        stop()
        resolve()
      })
    })
  }
  // Typing on while it waited makes this submission stale
  if (text !== query.value.trim()) return
  emit(
    'submit',
    text,
    filteredResults.value.some(r => r.name === text),
  )
}

const keyboardShortcuts = useKeyboardShortcuts()

function handleKeydown(e: KeyboardEvent) {
  // List navigation follows the shortcuts setting; Enter and Escape always work
  if (!keyboardShortcuts.value && e.key !== 'Enter' && e.key !== 'Escape') return

  const values = navigableValues.value
  const count = values.length

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (count === 0) return
      highlightedIndex.value = highlightedIndex.value < count - 1 ? highlightedIndex.value + 1 : 0
      break

    case 'ArrowUp':
      e.preventDefault()
      if (count === 0) return
      highlightedIndex.value = highlightedIndex.value > 0 ? highlightedIndex.value - 1 : count - 1
      break

    case 'PageDown':
      e.preventDefault()
      if (count === 0) return
      highlightedIndex.value =
        highlightedIndex.value === -1
          ? Math.min(PAGE_JUMP - 1, count - 1)
          : Math.min(highlightedIndex.value + PAGE_JUMP, count - 1)
      break

    case 'PageUp':
      e.preventDefault()
      if (count === 0) return
      highlightedIndex.value = Math.max(highlightedIndex.value - PAGE_JUMP, 0)
      break

    case 'Enter': {
      const trimmed = query.value.trim()
      if (!trimmed) return
      e.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < count) {
        emit('select', values[highlightedIndex.value]!)
        return
      }
      void submitWhenSearched(trimmed)
      break
    }

    case 'Escape':
      query.value = ''
      highlightedIndex.value = -1
      break
  }
}

watch(query, () => {
  highlightedIndex.value = -1
})

watch(highlightedIndex, index => {
  if (index >= 0 && listRef.value) {
    const items = listRef.value.querySelectorAll('[data-navigable]')
    ;(items[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  }
})

const containerRef = useTemplateRef('containerRef')
onClickOutside(containerRef, () => {
  isInputFocused.value = false
  highlightedIndex.value = -1
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <div class="relative group flex items-center">
      <label :for="inputId" class="sr-only">{{ label }}</label>
      <span
        class="absolute inset-is-3 text-fg-subtle font-mono text-md pointer-events-none transition-colors duration-200 motion-reduce:transition-none [.group:hover:not(:focus-within)_&]:text-fg/80 group-focus-within:text-accent z-1"
      >
        /
      </span>
      <InputBase
        :id="inputId"
        v-model="query"
        type="text"
        :aria-describedby="describedby"
        :placeholder="placeholder"
        no-correct
        class="w-full min-w-25 ps-7"
        aria-autocomplete="list"
        @focus="isInputFocused = true"
        @keydown="handleKeydown"
      />
    </div>

    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isInputFocused && (navigableValues.length > 0 || isSearching)"
        ref="listRef"
        class="absolute top-full inset-x-0 mt-1 px-0.5 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
      >
        <ButtonBase
          v-for="(option, index) in leading"
          :key="option.value"
          data-navigable
          class="block w-full text-start !border-transparent"
          :class="highlightedIndex === index ? '!bg-accent/15' : ''"
          :aria-label="option.label"
          @mouseenter="highlightedIndex = index"
          @click="emit('select', option.value)"
        >
          <slot name="option" :option="option">{{ option.label }}</slot>
        </ButtonBase>

        <div
          v-if="isSearching && navigableValues.length === 0"
          class="px-4 py-3 text-sm text-fg-muted"
        >
          {{ $t('search.searching') }}
        </div>
        <ButtonBase
          v-for="(result, index) in filteredResults"
          :key="result.name"
          data-navigable
          class="block w-full text-start my-0.5 !border-transparent"
          :class="highlightedIndex === index + leading.length ? '!bg-accent/15' : ''"
          @mouseenter="highlightedIndex = index + leading.length"
          @click="emit('select', result.name)"
        >
          <span class="font-mono text-sm text-fg block">{{ result.name }}</span>
          <span
            v-if="result.description"
            class="text-xs text-fg-muted truncate mt-0.5 w-full block"
          >
            {{ stripHtmlTags(decodeHtmlEntities(result.description)) }}
          </span>
        </ButtonBase>
      </div>
    </Transition>
  </div>
</template>
