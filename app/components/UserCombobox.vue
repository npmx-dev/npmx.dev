<script setup lang="ts">
const props = defineProps<{
  /** List of suggested usernames (e.g., org members) */
  suggestions: string[]
  /** Placeholder text */
  placeholder?: string
  /** Whether the input is disabled */
  disabled?: boolean
  /** Accessible label for the input */
  label?: string
}>()

const emit = defineEmits<{
  /** Emitted when a user is selected/submitted */
  select: [username: string, isInSuggestions: boolean]
}>()

const inputValue = shallowRef('')
const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)
const listRef = useTemplateRef('listRef')

// Generate unique ID for accessibility
const inputId = useId()
const listboxId = `${inputId}-listbox`

// Filter suggestions based on input
const filteredSuggestions = computed(() => {
  if (!inputValue.value.trim()) {
    return props.suggestions.slice(0, 10) // Show first 10 when empty
  }
  const query = inputValue.value.toLowerCase().replace(/^@/, '')
  return props.suggestions.filter(s => s.toLowerCase().includes(query)).slice(0, 10)
})

// Check if current input matches a suggestion exactly
const isExactMatch = computed(() => {
  const normalized = inputValue.value.trim().replace(/^@/, '').toLowerCase()
  return props.suggestions.some(s => s.toLowerCase() === normalized)
})

// Show hint when typing a non-member username
const showNewUserHint = computed(() => {
  const value = inputValue.value.trim().replace(/^@/, '')
  return value.length > 0 && !isExactMatch.value && filteredSuggestions.value.length === 0
})

function handleInput() {
  isOpen.value = true
  highlightedIndex.value = -1
}

function handleFocus() {
  isOpen.value = true
}

function handleBlur(event: FocusEvent) {
  // Don't close if clicking within the dropdown
  const relatedTarget = event.relatedTarget as HTMLElement | null
  if (relatedTarget && listRef.value?.contains(relatedTarget)) {
    return
  }
  // Delay to allow click to register
  setTimeout(() => {
    isOpen.value = false
    highlightedIndex.value = -1
  }, 150)
}

function selectSuggestion(username: string) {
  inputValue.value = username
  isOpen.value = false
  highlightedIndex.value = -1
  emit('select', username, true)
  inputValue.value = ''
}

function handleSubmit() {
  const username = inputValue.value.trim().replace(/^@/, '')
  if (!username) return

  const inSuggestions = props.suggestions.some(s => s.toLowerCase() === username.toLowerCase())
  emit('select', username, inSuggestions)
  inputValue.value = ''
  isOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      isOpen.value = true
      event.preventDefault()
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (highlightedIndex.value < filteredSuggestions.value.length - 1) {
        highlightedIndex.value++
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--
      }
      break
    case 'Enter': {
      event.preventDefault()
      const selectedSuggestion = filteredSuggestions.value[highlightedIndex.value]
      if (highlightedIndex.value >= 0 && selectedSuggestion) {
        selectSuggestion(selectedSuggestion)
      } else {
        handleSubmit()
      }
      break
    }
    case 'Escape':
      isOpen.value = false
      highlightedIndex.value = -1
      break
  }
}

// Scroll highlighted item into view
watch(highlightedIndex, index => {
  if (index >= 0 && listRef.value) {
    const item = listRef.value.children[index] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }
})

// Check for reduced motion preference
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
</script>

<template>
  <div class="relative">
    <label v-if="label" :for="inputId" class="sr-only">{{ label }}</label>
    <input
      :id="inputId"
      v-model="inputValue"
      type="text"
      :placeholder="placeholder ?? $t('user.combobox.default_placeholder')"
      :disabled="disabled"
      v-bind="noCorrect"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen && (filteredSuggestions.length > 0 || showNewUserHint)"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :aria-activedescendant="
        highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
      "
      class="w-full px-2 py-1 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-accent/70 disabled:opacity-50 disabled:cursor-not-allowed"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />

    <!-- Dropdown -->
    <Transition
      :enter-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-150'"
      :enter-from-class="prefersReducedMotion ? '' : 'opacity-0'"
      enter-to-class="opacity-100"
      :leave-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-100'"
      leave-from-class="opacity-100"
      :leave-to-class="prefersReducedMotion ? '' : 'opacity-0'"
    >
      <ul
        v-if="isOpen && (filteredSuggestions.length > 0 || showNewUserHint)"
        :id="listboxId"
        ref="listRef"
        role="listbox"
        :aria-label="label ?? $t('user.combobox.suggestions_label')"
        class="absolute z-50 w-full mt-1 py-1 bg-bg-elevated border border-border rounded shadow-lg max-h-48 overflow-y-auto"
      >
        <!-- Suggestions from org -->
        <li
          v-for="(username, index) in filteredSuggestions"
          :id="`${listboxId}-option-${index}`"
          :key="username"
          role="option"
          :aria-selected="highlightedIndex === index"
          class="px-2 py-1 font-mono text-sm cursor-pointer transition-colors duration-100"
          :class="
            highlightedIndex === index
              ? 'bg-bg-muted text-fg'
              : 'text-fg-muted hover:bg-bg-subtle hover:text-fg'
          "
          @mouseenter="highlightedIndex = index"
          @click="selectSuggestion(username)"
        >
          @{{ username }}
        </li>

        <!-- Hint for new user -->
        <li
          v-if="showNewUserHint"
          class="px-2 py-1 font-mono text-xs text-fg-subtle border-t border-border mt-1 pt-2"
          role="status"
          aria-live="polite"
        >
          <span class="i-carbon:information w-3 h-3 me-1 align-middle" aria-hidden="true" />
          {{
            $t('user.combobox.press_enter_to_add', {
              username: inputValue.trim().replace(/^@/, ''),
            })
          }}
          <span class="text-amber-400">{{ $t('user.combobox.add_to_org_hint') }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>
