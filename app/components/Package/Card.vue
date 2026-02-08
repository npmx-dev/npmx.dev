<script setup lang="ts">
import type { StructuredFilters } from '#shared/types/preferences'

const props = defineProps<{
  /** The search result object containing package data */
  result: NpmSearchResult
  /** Heading level for the package name (h2 for search, h3 for lists) */
  headingLevel?: 'h2' | 'h3'
  /** Whether to show the publisher username */
  showPublisher?: boolean
  prefetch?: boolean
  index?: number
  /** Filters to apply to the results */
  filters?: StructuredFilters
  /** Search query for highlighting exact matches */
  searchQuery?: string
}>()

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()

/** Check if this package is an exact match for the search query */
const isExactMatch = computed(() => {
  if (!props.searchQuery) return false
  const query = props.searchQuery.trim().toLowerCase()
  const name = props.result.package.name.toLowerCase()
  return query === name
})

// Process package description
const pkgDescription = useMarkdown(() => ({
  text: props.result.package.description ?? '',
  plain: true,
  packageName: props.result.package.name,
}))

const numberFormatter = useNumberFormatter()
</script>

<template>
  <BaseCard :isExactMatch="isExactMatch">
    <div class="mb-2 flex items-baseline justify-start gap-2">
      <component
        :is="headingLevel ?? 'h3'"
        class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all"
      >
        <NuxtLink
          :to="packageRoute(result.package.name)"
          :prefetch-on="prefetch ? 'visibility' : 'interaction'"
          class="decoration-none scroll-mt-48 scroll-mb-6 after:content-[''] after:absolute after:inset-0"
          :data-result-index="index"
          dir="ltr"
          >{{ result.package.name }}</NuxtLink
        >
        <span
          v-if="isExactMatch"
          class="text-xs px-1.5 py-0.5 ms-2 rounded bg-bg-elevated border border-border-hover text-fg"
          >{{ $t('search.exact_match') }}</span
        >
      </component>
      <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
      <!-- Mobile: version next to package name -->
      <div class="sm:hidden text-fg-subtle flex items-center gap-1.5 shrink-0">
        <span
          v-if="result.package.version"
          class="font-mono text-xs truncate max-w-20"
          :title="result.package.version"
        >
          v{{ result.package.version }}
        </span>
        <ProvenanceBadge
          v-if="result.package.publisher?.trustedPublisher"
          :provider="result.package.publisher.trustedPublisher.id"
          :package-name="result.package.name"
          :version="result.package.version"
          :linked="false"
          compact
        />
      </div>
    </div>
    <div class="flex justify-start items-start gap-4 sm:gap-8">
      <div class="min-w-0">
        <p v-if="pkgDescription" class="text-fg-muted text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3">
          <span v-html="pkgDescription" />
        </p>
        <div class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs text-fg-muted">
          <dl v-if="showPublisher || result.package.date" class="flex items-center gap-4 m-0">
            <div
              v-if="showPublisher && result.package.publisher?.username"
              class="flex items-center gap-1.5"
            >
              <dt class="sr-only">{{ $t('package.card.publisher') }}</dt>
              <dd class="font-mono">{{ result.package.publisher.username }}</dd>
            </div>
            <div v-if="result.package.date" class="flex items-center gap-1.5">
              <dt class="sr-only">{{ $t('package.card.published') }}</dt>
              <dd>
                <DateTime
                  :datetime="result.package.date"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
              </dd>
            </div>
            <div v-if="result.package.license" class="flex items-center gap-1.5">
              <dt class="sr-only">{{ $t('package.card.license') }}</dt>
              <dd>{{ result.package.license }}</dd>
            </div>
          </dl>
        </div>
        <!-- Mobile: downloads on separate row -->
        <dl
          v-if="result.downloads?.weekly"
          class="sm:hidden flex items-center gap-4 mt-2 text-xs text-fg-muted m-0"
        >
          <div class="flex items-center gap-1.5">
            <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
            <dd class="flex items-center gap-1.5">
              <span class="i-carbon:chart-line w-3.5 h-3.5" aria-hidden="true" />
              <span class="font-mono">{{ $n(result.downloads.weekly) }}/w</span>
            </dd>
          </div>
        </dl>
      </div>
      <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
      <!-- Desktop: version and downloads on right side -->
      <div class="hidden sm:flex flex-col gap-2 shrink-0">
        <div class="text-fg-subtle flex items-start gap-2 justify-end">
          <span
            v-if="result.package.version"
            class="font-mono text-xs truncate max-w-32"
            :title="result.package.version"
          >
            v{{ result.package.version }}
          </span>
          <div
            v-if="result.package.publisher?.trustedPublisher"
            class="flex items-center gap-1.5 shrink-0 max-w-32"
          >
            <ProvenanceBadge
              :provider="result.package.publisher.trustedPublisher.id"
              :package-name="result.package.name"
              :version="result.package.version"
              :linked="false"
              compact
            />
          </div>
        </div>
        <div
          v-if="result.downloads?.weekly"
          class="text-fg-subtle gap-2 flex items-center justify-end"
        >
          <span class="i-carbon:chart-line w-3.5 h-3.5" aria-hidden="true" />
          <span class="font-mono text-xs">
            {{ $n(result.downloads.weekly) }} {{ $t('common.per_week') }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="result.package.keywords?.length"
      :aria-label="$t('package.card.keywords')"
      class="relative z-10 flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border list-none m-0 p-0 pointer-events-none items-center"
    >
      <ButtonBase
        v-for="keyword in result.package.keywords.slice(0, 5)"
        class="pointer-events-auto"
        size="small"
        :key="keyword"
        :aria-pressed="props.filters?.keywords.includes(keyword)"
        :title="`Filter by ${keyword}`"
        :data-result-index="index"
        @click.stop="emit('clickKeyword', keyword)"
      >
        {{ keyword }}
      </ButtonBase>
      <span
        v-if="result.package.keywords.length > 5"
        class="text-fg-subtle text-xs pointer-events-auto"
        :title="result.package.keywords.slice(5).join(', ')"
      >
        +{{ numberFormatter.format(result.package.keywords.length - 5) }}
      </span>
    </div>
  </BaseCard>
</template>
