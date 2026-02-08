<script setup lang="ts">
import { NO_DEPENDENCY_ID } from '~/composables/usePackageComparison'

const packages = defineModel<string[]>({ required: true })

const props = defineProps<{
  /** Maximum number of packages allowed */
  max?: number
}>()

const maxPackages = computed(() => props.max ?? 4)

// Input state
const inputValue = shallowRef('')
const isInputFocused = shallowRef(false)

// Use the shared npm search composable
const { data: searchData, status } = useNpmSearch(inputValue, { size: 15 })

const isSearching = computed(() => status.value === 'pending')

// Trigger strings for "What Would James Do?" typeahead Easter egg
// Intentionally not localized
const EASTER_EGG_TRIGGERS = new Set([
  'no dep',
  'none',
  'vanilla',
  'diy',
  'zero',
  'nothing',
  '0',
  "don't",
  'native',
  'use the platform',
])

// Check if "no dependency" option should show in typeahead
const showNoDependencyOption = computed(() => {
  if (packages.value.includes(NO_DEPENDENCY_ID)) return false
  const input = inputValue.value.toLowerCase().trim()
  if (!input) return false
  return EASTER_EGG_TRIGGERS.has(input)
})

// Filter out already selected packages
const filteredResults = computed(() => {
  if (!searchData.value?.objects) return []
  return searchData.value.objects
    .map(o => ({
      name: o.package.name,
      description: o.package.description,
    }))
    .filter(r => !packages.value.includes(r.name))
})

const numberFormatter = useNumberFormatter()

function addPackage(name: string) {
  if (packages.value.length >= maxPackages.value) return
  if (packages.value.includes(name)) return

  // Keep NO_DEPENDENCY_ID always last
  if (name === NO_DEPENDENCY_ID) {
    packages.value = [...packages.value, name]
  } else if (packages.value.includes(NO_DEPENDENCY_ID)) {
    // Insert before the no-dep entry
    const withoutNoDep = packages.value.filter(p => p !== NO_DEPENDENCY_ID)
    packages.value = [...withoutNoDep, name, NO_DEPENDENCY_ID]
  } else {
    packages.value = [...packages.value, name]
  }
  inputValue.value = ''
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
        <!-- No dependency display -->
        <template v-if="pkg === NO_DEPENDENCY_ID">
          <span class="text-sm text-accent italic flex items-center gap-1.5">
            <span class="i-carbon:clean w-3.5 h-3.5" aria-hidden="true" />
            {{ $t('compare.no_dependency.label') }}
          </span>
        </template>
        <NuxtLink
          v-else
          :to="packageRoute(pkg)"
          class="font-mono text-sm text-fg hover:text-accent transition-colors"
        >
          {{ pkg }}
        </NuxtLink>
        <button
          type="button"
          class="text-fg-subtle hover:text-fg transition-colors rounded"
          :aria-label="
            $t('compare.selector.remove_package', {
              package: pkg === NO_DEPENDENCY_ID ? $t('compare.no_dependency.label') : pkg,
            })
          "
          @click="removePackage(pkg)"
        >
          <span class="i-carbon:close flex items-center w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Add package input -->
    <div v-if="packages.length < maxPackages" class="relative">
      <div class="relative group">
        <label for="package-search" class="sr-only">
          {{ $t('compare.selector.search_label') }}
        </label>
        <span
          class="absolute inset-y-0 start-3 flex items-center text-fg-subtle pointer-events-none group-focus-within:text-accent"
          aria-hidden="true"
        >
          <span class="i-carbon:search w-4 h-4" />
        </span>
        <input
          id="package-search"
          v-model="inputValue"
          type="text"
          :placeholder="
            packages.length === 0
              ? $t('compare.selector.search_first')
              : $t('compare.selector.search_add')
          "
          class="w-full bg-bg-subtle border border-border rounded-lg ps-10 pe-4 py-2.5 font-mono text-sm text-fg placeholder:text-fg-subtle motion-reduce:transition-none duration-200 focus:border-accent focus-visible:(outline-2 outline-accent/70)"
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
          v-if="
            isInputFocused && (filteredResults.length > 0 || isSearching || showNoDependencyOption)
          "
          class="absolute top-full inset-x-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <!-- No dependency option (easter egg with James) -->
          <button
            v-if="showNoDependencyOption"
            type="button"
            class="w-full text-start px-4 py-2.5 hover:bg-bg-muted transition-colors focus-visible:outline-none focus-visible:bg-bg-muted border-b border-border/50"
            :aria-label="$t('compare.no_dependency.add_column')"
            @click="addPackage(NO_DEPENDENCY_ID)"
          >
            <div class="text-sm text-accent italic flex items-center gap-2">
              <span class="i-carbon:clean w-4 h-4" aria-hidden="true" />
              {{ $t('compare.no_dependency.typeahead_title') }}
            </div>
            <div class="text-xs text-fg-muted truncate mt-0.5">
              {{ $t('compare.no_dependency.typeahead_description') }}
            </div>
          </button>

          <div v-if="isSearching" class="px-4 py-3 text-sm text-fg-muted">
            {{ $t('compare.selector.searching') }}
          </div>
          <button
            v-for="result in filteredResults"
            :key="result.name"
            type="button"
            class="w-full text-start px-4 py-2.5 hover:bg-bg-muted transition-colors focus-visible:outline-none focus-visible:bg-bg-muted"
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
      {{
        $t('compare.selector.packages_selected', {
          count: numberFormatter.format(packages.length),
          max: numberFormatter.format(maxPackages),
        })
      }}
      <span v-if="packages.length < 2">{{ $t('compare.selector.add_hint') }}</span>
    </p>
  </div>
</template>
