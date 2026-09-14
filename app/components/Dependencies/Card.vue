<script setup lang="ts">
import type { PackageDependencyItem } from '#shared/types/package-dependencies'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'
import type { StructuredFilters } from '#shared/types/preferences'
import { DEFAULT_FILTERS } from '#shared/types/preferences'

const props = defineProps<{
  insights?: PackageDependencyInsights
  item: PackageDependencyItem
  showSkeleton: boolean
  index?: number
  filters?: StructuredFilters
}>()

const { model: globalSearchQuery } = useGlobalSearch()

const activeFilters = computed<StructuredFilters>(() => {
  if (props.filters) return props.filters
  const parsed = parseSearchOperators(globalSearchQuery.value)
  return {
    ...DEFAULT_FILTERS,
    keywords: parsed.keywords ?? [],
    text: parsed.text ?? '',
  }
})

const targetName = computed(() => props.item.packageName || props.item.name)

// Fetch rich package metadata from API (with hydrated useState caching)
const { data: meta } = usePackageMeta(targetName)

const searchResult = computed(() => {
  if (!meta.value) return null
  const result = metaToSearchResult(meta.value)
  result.package.name = props.item.name
  result.package.version = props.item.range
  return result
})

const minVersion = computed(() => resolveMinVersion(props.item.range))

const packageUrl = computed(() => packageRoute(targetName.value, minVersion.value))

const isLoadingData = computed(() => {
  if (props.insights) {
    const vStatus = unref(props.insights.vulnStatus)
    const rStatus = unref(props.insights.replacementStatus)
    return (
      vStatus === 'pending' || vStatus === 'idle' || rStatus === 'pending' || rStatus === 'idle'
    )
  }
  return false
})

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()
</script>

<template>
  <BaseCard v-if="!searchResult || showSkeleton">
    <header class="mb-4 flex items-baseline justify-between gap-2">
      <div class="flex items-baseline justify-start gap-2">
        <h2
          class="font-mono text-sm sm:text-base font-medium text-fg group-hover:text-fg transition-colors duration-200 min-w-0 break-all inline-flex items-center gap-2"
        >
          <NuxtLink
            :to="packageUrl"
            class="decoration-none hover:text-accent-fallback after:content-[''] after:absolute after:inset-0 inline-flex items-center gap-2 min-w-0"
            :data-result-index="index"
          >
            <span class="i-simple-icons:npm w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span class="truncate" dir="ltr">{{ item.name }}</span>
          </NuxtLink>
        </h2>
        <DependenciesStatusIndicators
          :name="targetName"
          :flags="item.flags"
          :deprecated="searchResult?.package.deprecated"
          :is-loading="isLoadingData"
          class="z-10"
        />
      </div>
    </header>
    <SkeletonBlock class="h-5 w-full mb-2 sm:mb-3" />
    <div class="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs text-fg-muted">
      <div class="flex items-center gap-1.5 min-w-0 relative z-10">
        <dl>
          <dt class="sr-only">{{ $t('package.card.version') }}</dt>
          <dd class="font-mono truncate max-w-32">{{ item.range }}</dd>
        </dl>
      </div>
      <SkeletonBlock class="h-4 w-8ch" />
      <SkeletonBlock class="h-4 w-3ch" />
      <SkeletonBlock class="h-4 w-20ch sm:ms-auto" />
    </div>
  </BaseCard>

  <PackageCard
    v-else
    heading-level="h2"
    :result="searchResult"
    :index="index"
    :insights="insights || undefined"
    :filters="activeFilters"
    :to="packageUrl"
    version-is-range
    @click-keyword="emit('clickKeyword', $event)"
  >
    <template #status-indicators="{ insights }">
      <DependenciesStatusIndicators
        :name="targetName"
        :flags="item.flags"
        :deprecated="searchResult?.package.deprecated"
        v-bind="{ insights }"
        :is-loading="isLoadingData"
      />
    </template>
  </PackageCard>
</template>
