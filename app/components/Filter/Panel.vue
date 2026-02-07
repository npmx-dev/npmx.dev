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
  SEARCH_SCOPE_VALUES,
  SECURITY_FILTER_VALUES,
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

const { t } = useI18n()

const isExpanded = shallowRef(false)
const showAllKeywords = shallowRef(false)

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
const scopeLabelKeys = computed(
  () =>
    ({
      name: t('filters.scope_name'),
      description: t('filters.scope_description'),
      keywords: t('filters.scope_keywords'),
      all: t('filters.scope_all'),
    }) as const,
)

const scopeDescriptionKeys = computed(
  () =>
    ({
      name: t('filters.scope_name_description'),
      description: t('filters.scope_description_description'),
      keywords: t('filters.scope_keywords_description'),
      all: t('filters.scope_all_description'),
    }) as const,
)

const downloadRangeLabelKeys = computed(
  () =>
    ({
      'any': t('filters.download_range.any'),
      'lt100': t('filters.download_range.lt100'),
      '100-1k': t('filters.download_range.100_1k'),
      '1k-10k': t('filters.download_range.1k_10k'),
      '10k-100k': t('filters.download_range.10k_100k'),
      'gt100k': t('filters.download_range.gt100k'),
    }) as const,
)

const updatedWithinLabelKeys = computed(
  () =>
    ({
      any: t('filters.updated.any'),
      week: t('filters.updated.week'),
      month: t('filters.updated.month'),
      quarter: t('filters.updated.quarter'),
      year: t('filters.updated.year'),
    }) as const,
)

const securityLabelKeys = computed(
  () =>
    ({
      all: t('filters.security_options.all'),
      secure: t('filters.security_options.secure'),
      warnings: t('filters.security_options.insecure'),
    }) as const,
)

// Type-safe accessor functions
function getScopeLabelKey(value: SearchScope): string {
  return scopeLabelKeys.value[value]
}

function getScopeDescriptionKey(value: SearchScope): string {
  return scopeDescriptionKeys.value[value]
}

function getDownloadRangeLabelKey(value: DownloadRange): string {
  return downloadRangeLabelKeys.value[value]
}

function getUpdatedWithinLabelKey(value: UpdatedWithin): string {
  return updatedWithinLabelKeys.value[value]
}

function getSecurityLabelKey(value: SecurityFilter): string {
  return securityLabelKeys.value[value]
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
      class="w-full flex items-center gap-3 px-4 py-3 text-start hover:bg-bg-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset"
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
        class="i-carbon-chevron-down w-4 h-4 text-fg-subtle transition-transform duration-200 shrink-0 ms-auto"
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
                v-for="scope in SEARCH_SCOPE_VALUES"
                :key="scope"
                type="button"
                class="px-2 py-0.5 text-xs font-mono rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
                :class="
                  filters.searchScope === scope
                    ? 'bg-bg-muted text-fg'
                    : 'text-fg-muted hover:text-fg'
                "
                :aria-pressed="filters.searchScope === scope"
                :title="getScopeDescriptionKey(scope)"
                @click="emit('update:searchScope', scope)"
              >
                {{ getScopeLabelKey(scope) }}
              </button>
            </div>
          </div>
          <input
            id="filter-search"
            type="text"
            :value="filters.text"
            :placeholder="searchPlaceholder"
            autocomplete="off"
            class="w-full bg-bg-subtle border border-border rounded-md px-4 py-3 font-mono text-sm text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 hover:border-fg-subtle outline-2 outline-transparent focus:border-accent focus-visible:(outline-2 outline-accent/70)"
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
            <TagRadioButton
              v-for="range in DOWNLOAD_RANGES"
              :key="range.value"
              :model-value="filters.downloadRange"
              :value="range.value"
              @update:modelValue="emit('update:downloadRange', $event as DownloadRange)"
              name="range"
            >
              {{ getDownloadRangeLabelKey(range.value) }}
            </TagRadioButton>
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
            <TagRadioButton
              v-for="option in UPDATED_WITHIN_OPTIONS"
              :key="option.value"
              :model-value="filters.updatedWithin"
              :value="option.value"
              name="updatedWithin"
              @update:modelValue="emit('update:updatedWithin', $event as UpdatedWithin)"
            >
              {{ getUpdatedWithinLabelKey(option.value) }}
            </TagRadioButton>
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
            <TagRadioButton
              v-for="security in SECURITY_FILTER_VALUES"
              :key="security"
              disabled
              :model-value="filters.security"
              :value="security"
              name="security"
            >
              {{ getSecurityLabelKey(security) }}
            </TagRadioButton>
          </div>
        </fieldset>

        <!-- Keywords -->
        <fieldset v-if="displayedKeywords.length > 0" class="border-0 p-0 m-0 mt-4">
          <legend class="block text-sm font-mono text-fg-muted mb-1">
            {{ $t('filters.keywords') }}
          </legend>
          <div class="flex flex-wrap gap-1.5" role="group" :aria-label="$t('filters.keywords')">
            <ButtonBase
              v-for="keyword in displayedKeywords"
              :key="keyword"
              size="small"
              :aria-pressed="filters.keywords.includes(keyword)"
              @click="emit('toggleKeyword', keyword)"
            >
              {{ keyword }}
            </ButtonBase>
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
