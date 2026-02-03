<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import { normalizeSearchParam } from '#shared/utils/url'

withDefaults(
  defineProps<{
    inputClass?: string
  }>(),
  {
    inputClass: 'inline sm:block',
  },
)

const emit = defineEmits(['blur', 'focus'])

const router = useRouter()
const route = useRoute()

const isSearchFocused = shallowRef(false)

const showSearchBar = computed(() => {
  return route.name !== 'index'
})

// Local input value (updates immediately as user types)
const searchQuery = shallowRef(normalizeSearchParam(route.query.q))

// Pages that have their own local filter using ?q
const pagesWithLocalFilter = new Set(['~username', 'org'])

// Debounced URL update for search query
const updateUrlQuery = debounce((value: string) => {
  // Don't navigate away from pages that use ?q for local filtering
  if (pagesWithLocalFilter.has(route.name as string)) {
    return
  }
  if (route.name === 'search') {
    router.replace({ query: { q: value || undefined } })
    return
  }
  if (!value) {
    return
  }

  router.push({
    name: 'search',
    query: {
      q: value,
    },
  })
}, 250)

// Watch input and debounce URL updates
watch(searchQuery, value => {
  updateUrlQuery(value)
})

// Sync input with URL when navigating (e.g., back button)
watch(
  () => route.query.q,
  urlQuery => {
    // Don't sync from pages that use ?q for local filtering
    if (pagesWithLocalFilter.has(route.name as string)) {
      return
    }
    const value = normalizeSearchParam(urlQuery)
    if (searchQuery.value !== value) {
      searchQuery.value = value
    }
  },
)

function handleSearchBlur() {
  isSearchFocused.value = false
  emit('blur')
}
function handleSearchFocus() {
  isSearchFocused.value = true
  emit('focus')
}

function handleSubmit() {
  if (pagesWithLocalFilter.has(route.name as string)) {
    router.push({
      name: 'search',
      query: {
        q: searchQuery.value,
      },
    })
  } else {
    updateUrlQuery.flush()
  }
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
            class="absolute inset-is-3 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 motion-reduce:transition-none group-focus-within:text-accent z-1"
          >
            /
          </span>

          <input
            id="header-search"
            ref="inputRef"
            v-model="searchQuery"
            type="search"
            name="q"
            :placeholder="$t('search.placeholder')"
            v-bind="noCorrect"
            class="w-full min-w-25 bg-bg-subtle border border-border rounded-md ps-7 pe-3 py-1.5 font-mono text-sm text-fg placeholder:text-fg-subtle transition-border-color duration-300 motion-reduce:transition-none focus:border-accent focus-visible:(outline-2 outline-accent/70)"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
          />
          <button type="submit" class="sr-only">{{ $t('search.button') }}</button>
        </div>
      </div>
    </form>
  </search>
</template>
