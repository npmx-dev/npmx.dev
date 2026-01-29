<script setup lang="ts">
import type {
  DownloadRange,
  SearchScope,
  SecurityFilter,
  StructuredFilters,
  UpdatedWithin,
} from '#shared/types/preferences'
import {
  DOWNLOAD_RANGES,
  SEARCH_SCOPE_OPTIONS,
  SECURITY_FILTER_OPTIONS,
  UPDATED_WITHIN_OPTIONS,
} from '#shared/types/preferences'

const props = defineProps<{
  filters: StructuredFilters
  availableKeywords?: string[]
}>()

const emit = defineEmits<{
  'update:text': [value: string]
  'update:searchScope': [value: SearchScope]
  'update:downloadRange': [value: DownloadRange]
  'update:security': [value: SecurityFilter]
  'update:updatedWithin': [value: UpdatedWithin]
  'toggleKeyword': [keyword: string]
}>()

const isExpanded = ref(false)
const showAllKeywords = ref(false)

const displayedKeywords = computed(() => {
  const keywords = props.availableKeywords ?? []
  return showAllKeywords.value ? keywords : keywords.slice(0, 20)
})

const searchPlaceholder = computed(() => {
  switch (props.filters.searchScope) {
    case 'name':
      return $t('filters.search_placeholder_name')
    case 'description':
      return $t('filters.search_placeholder_description')
    case 'keywords':
      return $t('filters.search_placeholder_keywords')
    case 'all':
      return $t('filters.search_placeholder_all')
    default:
      return $t('filters.search_placeholder_name')
  }
})

const hasMoreKeywords = computed(() => {
  return !showAllKeywords.value && (props.availableKeywords?.length ?? 0) > 20
})

// i18n mappings for filter options
const scopeLabelKeys = {
  name: 'filters.scope_name',
  description: 'filters.scope_description',
  keywords: 'filters.scope_keywords',
  all: 'filters.scope_all',
} as const

const scopeDescriptionKeys = {
  name: 'filters.scope_name_description',
  description: 'filters.scope_description_description',
  keywords: 'filters.scope_keywords_description',
  all: 'filters.scope_all_description',
} as const

const downloadRangeLabelKeys = {
  'any': 'filters.download_range.any',
  'lt100': 'filters.download_range.lt100',
  '100-1k': 'filters.download_range.100_1k',
  '1k-10k': 'filters.download_range.1k_10k',
  '10k-100k': 'filters.download_range.10k_100k',
  'gt100k': 'filters.download_range.gt100k',
} as const

const updatedWithinLabelKeys = {
  any: 'filters.updated.any',
  week: 'filters.updated.week',
  month: 'filters.updated.month',
  quarter: 'filters.updated.quarter',
  year: 'filters.updated.year',
} as const

const securityLabelKeys = {
  all: 'filters.security_options.all',
  secure: 'filters.security_options.secure',
  warnings: 'filters.security_options.insecure',
} as const

// Type-safe accessor functions
function getScopeLabelKey(value: SearchScope): string {
  return scopeLabelKeys[value]
}

function getScopeDescriptionKey(value: SearchScope): string {
  return scopeDescriptionKeys[value]
}

function getDownloadRangeLabelKey(value: DownloadRange): string {
  return downloadRangeLabelKeys[value]
}

function getUpdatedWithinLabelKey(value: UpdatedWithin): string {
  return updatedWithinLabelKeys[value]
}

function getSecurityLabelKey(value: SecurityFilter): string {
  return securityLabelKeys[value]
}

function handleTextInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:text', target.value)
}

// Compact summary of active filters for collapsed header using operator syntax
const filterSummary = computed(() => {
  const parts: string[] = []

  // Text search with operator format
  if (props.filters.text) {
    if (props.filters.searchScope === 'all') {
      // Show raw text (may already contain operators)
      parts.push(props.filters.text)
    } else {
      // Convert scope to operator format
      const operatorMap: Record<string, string> = {
        name: 'name',
        description: 'desc',
        keywords: 'kw',
      }
      const op = operatorMap[props.filters.searchScope] ?? 'name'
      parts.push(`${op}:${props.filters.text}`)
    }
  }

  // Keywords from filter (not from text operators)
  if (props.filters.keywords.length > 0) {
    parts.push(`kw:${props.filters.keywords.join(',')}`)
  }

  // Download range (use compact value, not human label)
  if (props.filters.downloadRange !== 'any') {
    parts.push(`dl:${props.filters.downloadRange}`)
  }

  // Updated within (use compact value, not human label)
  if (props.filters.updatedWithin !== 'any') {
    parts.push(`updated:${props.filters.updatedWithin}`)
  }

  // Security (when enabled)
  if (props.filters.security !== 'all') {
    const label = props.filters.security === 'secure' ? 'secure' : 'warnings'
    parts.push(`security:${label}`)
  }

  return parts.length > 0 ? parts.join(' ') : null
})

const hasActiveFilters = computed(() => !!filterSummary.value)
</script>

<template>
  <div class="border border-border rounded-lg bg-bg-subtle">
    <!-- Collapsed header -->
    <button
      type="button"
      class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <span class="flex items-center gap-2 text-sm font-mono text-fg shrink-0">
        <span class="i-carbon-filter w-4 h-4" aria-hidden="true" />
        {{ $t('filters.title') }}
      </span>
      <span v-if="!isExpanded && hasActiveFilters" class="text-xs font-mono text-fg-muted truncate">
        {{ filterSummary }}
      </span>
      <span
        class="i-carbon-chevron-down w-4 h-4 text-fg-subtle transition-transform duration-200 shrink-0 ml-auto"
        :class="{ 'rotate-180': isExpanded }"
        aria-hidden="true"
      />
    </button>

    <!-- Expanded content -->
    <Transition name="expand">
      <div v-if="isExpanded" class="px-4 pb-5 border-t border-border">
        <!-- Text search -->
        <div class="pt-4">
          <div class="flex items-center gap-3 mb-1">
            <label for="filter-search" class="text-sm font-mono text-fg-muted">
              {{ $t('filters.search') }}
            </label>
            <!-- Search scope toggle -->
            <div
              class="inline-flex rounded-md border border-border p-0.5 bg-bg"
              role="group"
              :aria-label="$t('filters.search_scope')"
            >
              <button
                v-for="option in SEARCH_SCOPE_OPTIONS"
                :key="option.value"
                type="button"
                class="px-2 py-0.5 text-xs font-mono rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
                :class="
                  filters.searchScope === option.value
                    ? 'bg-bg-muted text-fg'
                    : 'text-fg-muted hover:text-fg'
                "
                :aria-pressed="filters.searchScope === option.value"
                :title="$t(getScopeDescriptionKey(option.value))"
                @click="emit('update:searchScope', option.value)"
              >
                {{ $t(getScopeLabelKey(option.value)) }}
              </button>
            </div>
          </div>
          <input
            id="filter-search"
            type="text"
            :value="filters.text"
            :placeholder="searchPlaceholder"
            autocomplete="off"
            class="input-base"
            @input="handleTextInput"
          />
        </div>

        <!-- Download range -->
        <fieldset class="border-0 p-0 m-0 mt-4">
          <legend class="block text-sm font-mono text-fg-muted mb-1">
            {{ $t('filters.weekly_downloads') }}
          </legend>
          <div
            class="flex flex-wrap gap-2"
            role="radiogroup"
            :aria-label="$t('filters.weekly_downloads')"
          >
            <button
              v-for="range in DOWNLOAD_RANGES"
              :key="range.value"
              type="button"
              role="radio"
              :aria-checked="filters.downloadRange === range.value"
              class="tag transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
              :class="filters.downloadRange === range.value ? 'bg-fg text-bg border-fg' : ''"
              @click="emit('update:downloadRange', range.value)"
            >
              {{ $t(getDownloadRangeLabelKey(range.value)) }}
            </button>
          </div>
        </fieldset>

        <!-- Updated within -->
        <fieldset class="border-0 p-0 m-0 mt-4">
          <legend class="block text-sm font-mono text-fg-muted mb-1">
            {{ $t('filters.updated_within') }}
          </legend>
          <div
            class="flex flex-wrap gap-2"
            role="radiogroup"
            :aria-label="$t('filters.updated_within')"
          >
            <button
              v-for="option in UPDATED_WITHIN_OPTIONS"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="filters.updatedWithin === option.value"
              class="tag transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
              :class="filters.updatedWithin === option.value ? 'bg-fg text-bg border-fg' : ''"
              @click="emit('update:updatedWithin', option.value)"
            >
              {{ $t(getUpdatedWithinLabelKey(option.value)) }}
            </button>
          </div>
        </fieldset>

        <!-- Security -->
        <fieldset class="border-0 p-0 m-0 mt-4">
          <legend class="flex items-center gap-2 text-sm font-mono text-fg-muted mb-1">
            {{ $t('filters.security') }}
            <span class="text-xs px-1.5 py-0.5 rounded bg-bg-muted text-fg-subtle">
              {{ $t('filters.columns.coming_soon') }}
            </span>
          </legend>
          <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="$t('filters.security')">
            <button
              v-for="option in SECURITY_FILTER_OPTIONS"
              :key="option.value"
              type="button"
              role="radio"
              disabled
              :aria-checked="filters.security === option.value"
              class="tag transition-colors duration-200 opacity-50 cursor-not-allowed focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
              :class="filters.security === option.value ? 'bg-fg text-bg border-fg' : ''"
            >
              {{ $t(getSecurityLabelKey(option.value)) }}
            </button>
          </div>
        </fieldset>

        <!-- Keywords -->
        <fieldset v-if="displayedKeywords.length > 0" class="border-0 p-0 m-0 mt-4">
          <legend class="block text-sm font-mono text-fg-muted mb-1">
            {{ $t('filters.keywords') }}
          </legend>
          <div class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('filters.keywords')">
            <button
              v-for="keyword in displayedKeywords"
              :key="keyword"
              type="button"
              :aria-pressed="filters.keywords.includes(keyword)"
              class="tag text-xs transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
              :class="filters.keywords.includes(keyword) ? 'bg-fg text-bg border-fg' : ''"
              @click="emit('toggleKeyword', keyword)"
            >
              {{ keyword }}
            </button>
            <button
              v-if="hasMoreKeywords"
              type="button"
              class="text-xs text-fg-subtle self-center font-mono hover:text-fg transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
              @click="showAllKeywords = true"
            >
              {{ $t('filters.more_keywords', { count: (availableKeywords?.length ?? 0) - 20 }) }}
            </button>
          </div>
        </fieldset>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.2s ease,
    padding 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}
</style>
