<script setup lang="ts">
withDefaults(
  defineProps<{
    inputClass?: string
  }>(),
  {
    inputClass: 'inline sm:block',
  },
)

const emit = defineEmits(['blur', 'focus'])
const route = useRoute()
const isSearchFocused = shallowRef(false)

const showSearchBar = computed(() => {
  return route.name !== 'index'
})

const { model: searchQuery, startSearch } = useGlobalSearch('header')
const hasSearchQuery = computed(() => searchQuery.value.trim().length > 0)

function handleSubmit() {
  startSearch()
}

function clearSearch() {
  searchQuery.value = ''
  inputRef.value?.focus()
}

// Expose focus method for parent components
const inputRef = useTemplateRef('inputRef')
function focus() {
  inputRef.value?.focus()
}
defineExpose({ focus })
</script>
<template>
  <search v-if="showSearchBar" :class="'flex-1 sm:max-w-md ' + inputClass">
    <form method="GET" action="/search" class="relative" @submit.prevent="handleSubmit">
      <label for="header-search" class="sr-only">
        {{ $t('search.label') }}
      </label>

      <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
        <div class="search-box relative flex items-center">
          <span
            class="absolute inset-is-3 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 motion-reduce:transition-none [.group:hover:not(:focus-within)_&]:text-fg/80 group-focus-within:text-accent z-1"
          >
            /
          </span>

          <InputBase
            id="header-search"
            ref="inputRef"
            v-model="searchQuery"
            type="search"
            name="q"
            :placeholder="$t('search.placeholder')"
            no-correct
            class="w-full min-w-25 ps-7 pe-8"
            @focus="isSearchFocused = true"
            @blur="isSearchFocused = false"
            size="small"
          />
          <button
            v-if="hasSearchQuery"
            type="button"
            class="absolute inset-ie-2 h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-focus-within:flex group-hover:inline-flex hidden"
            @click="clearSearch"
            aria-hidden="true"
            tabindex="-1"
          >
            <span class="i-lucide:circle-x h-4 w-4" />
          </button>
          <button type="submit" class="sr-only">{{ $t('search.button') }}</button>
        </div>
      </div>
    </form>
  </search>
</template>
