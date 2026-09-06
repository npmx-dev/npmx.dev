<script setup lang="ts">
import type { PackageDependencyItem } from '#shared/types/package-dependencies'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'
import type { ColumnConfig, StructuredFilters } from '#shared/types/preferences'
import { DEFAULT_COLUMNS, DEFAULT_FILTERS } from '#shared/types/preferences'
import { getVersionClass, getOutdatedTooltip } from '~/utils/npm/problematic-dependencies'

const props = defineProps<{
  insights?: PackageDependencyInsights
  item: PackageDependencyItem
  showSkeleton: boolean
  index?: number
  columns?: ColumnConfig[]
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

const item = computed(() => props.item)

const targetName = computed(() => item.value.packageName || item.value.name)

// Fetch rich package metadata from API (with hydrated useState caching)
const { data: meta } = usePackageMeta(targetName)

const searchResult = computed(() => {
  if (!meta.value) return null
  const result = metaToSearchResult(meta.value)
  result.package.name = item.value.name
  result.package.version = item.value.range
  return result
})

const packageUrl = computed(() => packageRoute(targetName.value))

const activeColumns = computed(() => props.columns ?? DEFAULT_COLUMNS)

function isColumnVisible(id: string): boolean {
  return activeColumns.value.find(c => c.id === id)?.visible ?? false
}

const outdated = computed(() => props.insights?.outdatedDeps.value?.[item.value.name])

const versionClass = computed(() => getVersionClass(item.value.name, props.insights))

const { t } = useI18n()

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()
</script>

<template>
  <PackageTableRow
    v-if="searchResult && !showSkeleton"
    :result="searchResult"
    :columns="activeColumns"
    :index="index"
    :insights="insights || undefined"
    :filters="activeFilters"
    :to="packageUrl"
    @click-keyword="emit('clickKeyword', $event)"
  >
    <template #version="{ version }">
      <TooltipApp v-if="outdated" :text="getOutdatedTooltip(outdated, t)" position="top">
        <div :class="versionClass" class="flex items-center gap-1.5 cursor-help">
          <span class="i-lucide:arrow-up w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{{ version }}</span>
        </div>
      </TooltipApp>
      <div v-else class="flex items-center gap-1.5">
        <span>{{ version }}</span>
      </div>
    </template>
    <template #status-indicators="{ insights }">
      <DependenciesStatusIndicators
        :name="item.name"
        :package-name="targetName"
        :flags="item.flags"
        v-bind="{ insights }"
        class="relative z-10"
      />
    </template>
  </PackageTableRow>

  <!-- Skeleton row -->
  <tr v-else class="border-b border-border relative">
    <!-- Name (always visible) -->
    <td class="py-2 px-3 inline-flex items-center gap-2">
      <NuxtLink
        :to="packageUrl"
        class="row-link font-mono text-sm transition-colors duration-200 inline-flex items-center gap-2 min-w-0 after:content-[''] after:absolute after:inset-0"
        :data-result-index="index"
      >
        <span class="i-simple-icons:npm w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate" dir="ltr">{{ item.name }}</span>
        <DependenciesStatusIndicators
          :name="item.name"
          :package-name="targetName"
          :flags="item.flags"
          class="relative z-10"
        />
      </NuxtLink>
      <DependenciesStatusIndicators
        :name="item.name"
        :package-name="targetName"
        :flags="item.flags"
        class="relative z-10"
      />
    </td>

    <!-- Version -->
    <td
      v-if="isColumnVisible('version')"
      class="py-2 px-3 font-mono text-xs text-fg-subtle relative z-10"
    >
      <span dir="ltr">{{ item.range }}</span>
    </td>

    <!-- Description -->
    <td
      v-if="isColumnVisible('description')"
      class="py-2 px-3 text-sm text-fg-muted max-w-xs truncate"
    >
      <SkeletonBlock class="h-4 w-48" />
    </td>

    <!-- Downloads -->
    <td
      v-if="isColumnVisible('downloads')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      <SkeletonBlock class="h-4 w-16 ms-auto" />
    </td>

    <!-- Updated -->
    <td
      v-if="isColumnVisible('updated')"
      class="py-2 px-3 font-mono text-end text-xs text-fg-muted"
    >
      <SkeletonBlock class="h-4 w-20 ms-auto" />
    </td>

    <!-- Maintainers -->
    <td v-if="isColumnVisible('maintainers')" class="py-2 px-3 text-sm text-fg-muted text-end">
      <SkeletonBlock class="h-4 w-24 ms-auto" />
    </td>

    <!-- Keywords -->
    <td v-if="isColumnVisible('keywords')" class="py-2 px-3 text-end">
      <SkeletonBlock class="h-4 w-32 ms-auto" />
    </td>

    <!-- Security -->
    <td v-if="isColumnVisible('security')" class="py-2 px-3">
      <span class="text-fg-subtle"> - </span>
    </td>
  </tr>
</template>

<style scoped>
.row-link {
  &:focus-visible {
    outline: 2px solid var(--color-fg);
    outline-offset: -2px;
  }
}
</style>
