<script setup lang="ts">
import type { SearchSuggestionOption } from '~/composables/useSearchSuggestions'

const props = withDefaults(
  defineProps<{
    listId: string
    options: SearchSuggestionOption[]
    expanded: boolean
    pending: boolean
    query: string
    size?: 'sm' | 'lg'
  }>(),
  {
    size: 'sm',
  },
)

const active = defineModel<number>('active', { required: true })

const emit = defineEmits<{
  select: [option: SearchSuggestionOption]
}>()

const packagesCount = computed(() => props.options.filter(o => o.kind === 'package').length)

const announcement = computed(() => {
  if (!props.expanded || props.pending) return ''
  return $t('search.suggestions_count', { count: packagesCount.value, query: props.query })
})
</script>

<template>
  <div
    v-show="expanded"
    class="absolute z-50 inset-x-0 top-full mt-2 overflow-hidden bg-bg-elevated border border-border shadow-lg text-start"
    :class="size === 'lg' ? 'rounded-xl' : 'rounded-lg'"
    @mousedown.prevent
  >
    <ul
      :id="listId"
      role="listbox"
      :aria-label="$t('search.suggestions_label')"
      :aria-busy="pending"
      class="m-0 p-1 list-none overflow-y-auto max-h-[min(52vh,24rem)]"
    >
      <li
        v-for="(option, i) in options"
        :id="option.id"
        :key="option.id"
        role="option"
        :aria-selected="i === active"
        class="flex items-center gap-3 px-3 font-mono cursor-pointer transition-colors duration-100 motion-reduce:transition-none"
        :class="[
          size === 'lg' ? 'min-h-11 text-base rounded-lg' : 'min-h-8 text-xs rounded-md',
          i === active ? 'bg-bg-muted text-fg' : 'text-fg-muted',
          option.kind === 'search' && 'mt-1 border-t border-border rounded-t-none',
        ]"
        @mousemove="active = i"
        @click="emit('select', option)"
      >
        <span v-if="option.kind === 'package'" class="flex-1 min-w-0 truncate">
          {{ option.label }}
        </span>
        <span v-else class="flex-1 min-w-0 truncate flex items-center gap-2">
          <span class="i-lucide:search shrink-0 w-3.5 h-3.5" aria-hidden="true" />
          {{ $t('search.suggestions_search_all', { query: option.label }) }}
        </span>
        <kbd
          class="shrink-0 text-fg-subtle text-xs"
          :class="i === active ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        >
          Enter
        </kbd>
      </li>
    </ul>
  </div>
  <p class="sr-only" aria-live="polite">{{ announcement }}</p>
</template>

<style scoped>
@media (forced-colors: active) {
  li[aria-selected='true'] {
    outline: 2px solid Highlight;
    outline-offset: -2px;
  }
}
</style>
