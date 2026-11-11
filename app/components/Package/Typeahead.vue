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

// Not gated by the keyboard shortcuts setting: these are the combobox's own keys, and without
// them the options aren't reachable by keyboard
function handleKeydown(e: KeyboardEvent) {
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

const listboxId = useId()
const optionId = (index: number) => `${listboxId}-option-${index}`
const isOpen = computed(
  () => isInputFocused.value && (navigableValues.value.length > 0 || isSearching.value),
)
const hasOptions = computed(() => isOpen.value && navigableValues.value.length > 0)

function closeList() {
  isInputFocused.value = false
  highlightedIndex.value = -1
}
const containerRef = useTemplateRef('containerRef')
onClickOutside(containerRef, closeList)
// Tabbing away must close it too, or the open list covers whatever gets focus next
function onFocusout(e: FocusEvent) {
  if (!containerRef.value?.contains(e.relatedTarget as Node | null)) closeList()
}
</script>

<template>
  <div ref="containerRef" class="relative" @focusout="onFocusout">
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
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        :aria-expanded="hasOptions"
        :aria-controls="hasOptions ? listboxId : undefined"
        :aria-activedescendant="
          hasOptions && highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined
        "
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
        v-if="isOpen"
        ref="listRef"
        class="absolute top-full inset-x-0 mt-1 px-0.5 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
      >
        <!-- Options aren't focusable: focus stays in the input, as the combobox pattern expects.
             mousedown.prevent keeps it there when one is clicked. -->
        <div v-if="hasOptions" :id="listboxId" role="listbox" :aria-label="label">
          <div
            v-for="(option, index) in leading"
            :id="optionId(index)"
            :key="option.value"
            data-navigable
            role="option"
            :aria-selected="highlightedIndex === index"
            :aria-label="option.label"
            class="block w-full cursor-pointer rounded-md px-4 py-2 text-start font-mono text-sm"
            :class="highlightedIndex === index ? 'bg-accent/15' : ''"
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent
            @click="emit('select', option.value)"
          >
            <slot name="option" :option="option">{{ option.label }}</slot>
          </div>
          <div
            v-for="(result, index) in filteredResults"
            :id="optionId(index + leading.length)"
            :key="result.name"
            data-navigable
            role="option"
            :aria-selected="highlightedIndex === index + leading.length"
            class="block w-full cursor-pointer rounded-md px-4 py-2 my-0.5 text-start"
            :class="highlightedIndex === index + leading.length ? 'bg-accent/15' : ''"
            @mouseenter="highlightedIndex = index + leading.length"
            @mousedown.prevent
            @click="emit('select', result.name)"
          >
            <span class="font-mono text-sm text-fg block">{{ result.name }}</span>
            <span
              v-if="result.description"
              class="text-xs text-fg-muted truncate mt-0.5 w-full block"
            >
              {{ stripHtmlTags(decodeHtmlEntities(result.description)) }}
            </span>
          </div>
        </div>
        <div v-else class="px-4 py-3 text-sm text-fg-muted">
          {{ $t('search.searching') }}
        </div>
      </div>
    </Transition>
  </div>
</template>
