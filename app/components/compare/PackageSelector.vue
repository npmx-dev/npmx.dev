<script setup lang="ts">
import { debounce } from 'perfect-debounce'

const { t } = useI18n()

const packages = defineModel<string[]>({ required: true })

const props = defineProps<{
  /** Maximum number of packages allowed */
  max?: number
}>()

const maxPackages = computed(() => props.max ?? 4)

// Input state
const inputValue = ref('')
const isInputFocused = ref(false)

// Search state
const searchResults = ref<Array<{ name: string; description?: string }>>([])
const isSearching = ref(false)

// Debounced search
const performSearch = debounce(async (query: string) => {
  if (!query.trim()) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  try {
    const response = await $fetch<{
      objects: Array<{ package: { name: string; description?: string } }>
    }>(`https://registry.npmjs.org/-/v1/search`, {
      query: { text: query, size: 15 },
    })
    searchResults.value = response.objects.map(o => ({
      name: o.package.name,
      description: o.package.description,
    }))
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}, 200)

watch(inputValue, value => {
  performSearch(value)
})

// Filter out already selected packages
const filteredResults = computed(() => {
  return searchResults.value.filter(r => !packages.value.includes(r.name))
})

function addPackage(name: string) {
  if (packages.value.length >= maxPackages.value) return
  if (packages.value.includes(name)) return

  packages.value = [...packages.value, name]
  inputValue.value = ''
  searchResults.value = []
}

function removePackage(name: string) {
  packages.value = packages.value.filter(p => p !== name)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && inputValue.value.trim()) {
    e.preventDefault()
    addPackage(inputValue.value.trim())
  }
}

function handleBlur() {
  useTimeoutFn(() => {
    isInputFocused.value = false
  }, 200)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Selected packages -->
    <div v-if="packages.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="pkg in packages"
        :key="pkg"
        class="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-subtle border border-border rounded-md"
      >
        <NuxtLink
          :to="`/${pkg}`"
          class="font-mono text-sm text-fg hover:text-accent transition-colors"
        >
          {{ pkg }}
        </NuxtLink>
        <button
          type="button"
          class="text-fg-subtle hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
          :aria-label="t('compare.selector.remove_package', { package: pkg })"
          @click="removePackage(pkg)"
        >
          <span class="i-carbon:close block w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Add package input -->
    <div v-if="packages.length < maxPackages" class="relative">
      <div class="relative">
        <span
          class="absolute inset-is-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        >
          <span class="i-carbon:search w-4 h-4" />
        </span>
        <input
          v-model="inputValue"
          type="text"
          :placeholder="
            packages.length === 0
              ? t('compare.selector.search_first')
              : t('compare.selector.search_add')
          "
          class="w-full bg-bg-subtle border border-border rounded-lg ps-10 pe-4 py-2.5 font-mono text-sm text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-accent focus-visible:outline-none"
          aria-autocomplete="list"
          @focus="isInputFocused = true"
          @blur="handleBlur"
          @keydown="handleKeydown"
        />
      </div>

      <!-- Search results dropdown -->
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isInputFocused && (filteredResults.length > 0 || isSearching)"
          class="absolute top-full inset-x-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <div v-if="isSearching" class="px-4 py-3 text-sm text-fg-muted">
            {{ t('compare.selector.searching') }}
          </div>
          <button
            v-for="result in filteredResults"
            :key="result.name"
            type="button"
            class="w-full text-left px-4 py-2.5 hover:bg-bg-muted transition-colors focus-visible:outline-none focus-visible:bg-bg-muted"
            @click="addPackage(result.name)"
          >
            <div class="font-mono text-sm text-fg">{{ result.name }}</div>
            <div v-if="result.description" class="text-xs text-fg-muted truncate mt-0.5">
              {{ result.description }}
            </div>
          </button>
        </div>
      </Transition>
    </div>

    <!-- Hint -->
    <p class="text-xs text-fg-subtle">
      {{ t('compare.selector.packages_selected', { count: packages.length, max: maxPackages }) }}
      <span v-if="packages.length < 2">{{ t('compare.selector.add_hint') }}</span>
    </p>
  </div>
</template>
