<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { StructuredFilters } from '#shared/types/preferences'
import { getOutdatedTooltip, getVersionClass } from '~/utils/npm/problematic-dependencies'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'

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
  /** Optional pre-computed insights to avoid duplicate fetching/processing */
  insights?: PackageDependencyInsights
  /** Version by default, adds "v" prefix. */
  versionIsRange?: boolean
  to?: RouteLocationRaw | string
}>()

const { selectable } = usePackageSelectionContext()
const { isPackageSelected, togglePackageSelection, canSelectMore } = usePackageSelection()
const isSelected = computed<boolean>(() => {
  return isPackageSelected(props.result.package.name)
})

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()

/** Check if this package is an exact match for the search query */
const packageUrl = computed(() => props.to ?? packageRoute(props.result.package.name))

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
}))

const insights = computed(() => props.insights)

const standaloneReplacementRes = useModuleReplacement(() => props.result.package.name)
const standaloneDepAnalysisRes = useDependencyAnalysis(
  () => props.result.package.name,
  () => props.result.package.version,
)

const hasReplacement = computed(() => {
  if (insights.value) {
    return !!unref(insights.value.replacementDeps)?.[props.result.package.name]
  }
  return !!standaloneReplacementRes.data.value?.replacement
})

const effectiveVulnTree = computed(() => {
  if (insights.value) {
    return unref(insights.value.vulnTree)
  }
  return standaloneDepAnalysisRes.data.value ?? undefined
})

const isLoadingData = computed(() => {
  if (insights.value) {
    const vStatus = unref(insights.value.vulnStatus)
    const rStatus = unref(insights.value.replacementStatus)
    return (
      vStatus === 'pending' || vStatus === 'idle' || rStatus === 'pending' || rStatus === 'idle'
    )
  }
  const vulnPending =
    standaloneDepAnalysisRes.status.value === 'pending' ||
    (standaloneDepAnalysisRes.status.value === 'idle' &&
      standaloneDepAnalysisRes.data.value === undefined)
  const replacementPending =
    standaloneReplacementRes.status.value === 'pending' ||
    (standaloneReplacementRes.status.value === 'idle' &&
      standaloneReplacementRes.data.value === undefined)
  return vulnPending || replacementPending
})

const numberFormatter = useNumberFormatter()
</script>

<template>
  <BaseCard :selected="isSelected" :isExactMatch="isExactMatch">
    <header class="mb-4 flex items-baseline justify-between gap-2">
      <div class="flex items-baseline justify-start gap-2">
        <component
          :is="headingLevel ?? 'h3'"
          class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all inline-flex items-center gap-2"
        >
          <NuxtLink
            :to="packageUrl"
            :prefetch-on="prefetch ? 'visibility' : 'interaction'"
            class="decoration-none hover:text-accent-fallback after:content-[''] after:absolute after:inset-0 inline-flex items-center gap-2 min-w-0"
            :data-result-index="index"
          >
            <span class="i-simple-icons:npm w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span class="truncate" dir="ltr">{{ result.package.name }}</span>
          </NuxtLink>
          <span
            v-if="isExactMatch"
            class="text-xs px-1.5 py-0.5 ms-2 rounded bg-bg-elevated border border-border-hover text-fg z-10"
            >{{ $t('search.exact_match') }}</span
          >
        </component>
        <slot name="status-indicators" :insights="insights">
          <DependenciesStatusIndicators
            :name="result.package.name"
            :deprecated="result.package.deprecated"
            :has-replacement="hasReplacement"
            :vuln-tree="effectiveVulnTree"
            :insights="insights"
            :is-loading="isLoadingData"
            class="z-10"
          />
        </slot>
      </div>

      <PackageSelectionCheckbox
        v-if="selectable"
        :package-name="result.package.name"
        :disabled="!canSelectMore && !isSelected"
        :checked="isSelected"
        @change="togglePackageSelection"
        class="z-10"
      />
    </header>

    <p v-if="pkgDescription" class="text-fg-muted text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3">
      <span v-html="pkgDescription" />
    </p>
    <div class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs text-fg-muted">
      <ProvenanceBadge
        v-if="result.package.publisher?.trustedPublisher"
        :provider="result.package.publisher.trustedPublisher.id"
        :package-name="result.package.name"
        :version="result.package.version"
        :linked="false"
        compact
      />
      <dl class="contents m-0">
        <div v-if="result.package.version" class="contents">
          <dt class="sr-only">{{ $t('package.card.version') }}</dt>
          <dd class="flex items-center gap-1.5 font-mono max-w-32">
            <TooltipApp
              v-if="insights?.outdatedDeps.value?.[result.package.name]"
              :text="getOutdatedTooltip(insights.outdatedDeps.value[result.package.name]!, $t)"
              position="top"
            >
              <div
                :class="getVersionClass(result.package.name, insights)"
                class="inline-flex items-center gap-1 cursor-help py-3 -my-3 z-10 max-w-32"
              >
                <span class="i-lucide:arrow-up w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span class="truncate"
                  >{{ versionIsRange ? '' : 'v' }}{{ result.package.version }}</span
                >
              </div>
            </TooltipApp>
            <div v-else class="inline-flex items-center gap-1 py-3 -my-3 z-10">
              <span> {{ versionIsRange ? '' : 'v' }}{{ result.package.version }} </span>
            </div>
          </dd>
        </div>
        <div v-if="result.package.date" class="flex items-center gap-1.5">
          <dt class="sr-only">{{ $t('package.card.published') }}</dt>
          <dd>
            <DateTime :datetime="result.package.date" year="numeric" month="short" day="numeric" />
          </dd>
        </div>
        <div
          v-if="showPublisher && result.package.publisher?.username"
          class="flex items-center gap-1.5"
        >
          <dt class="sr-only">{{ $t('package.card.publisher') }}</dt>
          <dd class="font-mono">{{ result.package.publisher.username }}</dd>
        </div>
        <div v-if="result.package.license" class="flex items-center gap-1.5">
          <dt class="sr-only">{{ $t('package.card.license') }}</dt>
          <dd>{{ result.package.license }}</dd>
        </div>
        <div v-if="result.downloads?.weekly != null" class="flex items-center gap-1.5 sm:ms-auto">
          <dt class="sr-only">{{ $t('package.card.weekly_downloads') }}</dt>
          <dd class="flex items-center gap-1.5">
            <span class="i-lucide:chart-line w-3.5 h-3.5" aria-hidden="true" />
            <span class="font-mono">
              {{ $n(result.downloads.weekly) }} {{ $t('common.per_week') }}
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <ul
      v-if="result.package.keywords?.length"
      :aria-label="$t('package.card.keywords')"
      class="relative z-10 flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border list-none m-0 p-0 pointer-events-none items-center"
    >
      <li v-for="keyword in result.package.keywords.slice(0, 5)" :key="keyword">
        <ButtonBase
          class="pointer-events-auto"
          size="sm"
          :aria-pressed="props.filters?.keywords?.includes(keyword)"
          :title="`Filter by ${keyword}`"
          @click.stop="emit('clickKeyword', keyword)"
        >
          {{ keyword }}
        </ButtonBase>
      </li>
      <li>
        <span
          v-if="result.package.keywords.length > 5"
          class="text-fg-subtle text-xs pointer-events-auto"
          :title="result.package.keywords.slice(5).join(', ')"
        >
          +{{ numberFormatter.format(result.package.keywords.length - 5) }}
        </span>
      </li>
    </ul>

    <slot name="extra" />
  </BaseCard>
</template>
