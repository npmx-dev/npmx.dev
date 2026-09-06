<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { InstallSizeResult } from '#shared/types/install-size'
import { packageRoute, packageStatsRoute } from '~/utils/router'

const props = defineProps<{
  packageName: string
  declaredRange: string
}>()

const { locale } = useI18n()

const comparisonSpecs = computed(() => [props.packageName])

const { data: pkg } = usePackage(() => props.packageName)
const { getFacetValues, isFacetLoading, isColumnLoading, status } =
  usePackageComparison(comparisonSpecs)
const { facetLabels } = useFacetSelection()

const resolvedVersion = computed(() => pkg.value?.['dist-tags']?.latest ?? null)

const { data: moduleReplacement } = useModuleReplacement(() => props.packageName)
const { data: licenseChangeData } = useLicenseChanges(() => props.packageName, resolvedVersion)

const { data: installSize, execute: fetchInstallSize } = useLazyFetch<InstallSizeResult | null>(
  () => {
    const version = resolvedVersion.value
    if (!version) return ''
    return `/api/registry/install-size/${props.packageName}/v/${version}`
  },
  {
    server: false,
    immediate: false,
  },
)

watch(
  resolvedVersion,
  version => {
    if (version) fetchInstallSize()
  },
  { immediate: true },
)

const { diff: sizeDiff } = useInstallSizeDiff(
  () => props.packageName,
  resolvedVersion,
  pkg,
  installSize,
)

const statsLink = computed((): RouteLocationRaw | null => {
  if (!resolvedVersion.value) return null
  return packageStatsRoute(props.packageName, resolvedVersion.value)
})

const facetRows = computed(() =>
  ALL_FACETS.map(facet => ({
    id: facet,
    label: facetLabels.value[facet].label,
    value: getFacetValues(facet)[0] ?? null,
    loading: isFacetLoading(facet) || isColumnLoading(0),
  })),
)

function formatFacetValue(value: FacetValue): string {
  if (value.type === 'date') {
    return new Date(value.display).toLocaleDateString(locale.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return value.display
}
</script>

<template>
  <header class="shrink-0 border-b border-border px-4 py-3 flex flex-wrap gap-3">
    <div class="flex-1">
      <h2 class="font-mono text-lg font-medium truncate">
        <NuxtLink
          :to="packageRoute(packageName, resolvedVersion)"
          class="text-fg hover:text-accent transition-colors"
        >
          {{ packageName }}
        </NuxtLink>
      </h2>
      <p class="text-xs text-fg-muted font-mono mt-0.5">
        <span>{{ $t('deps_stats.stats.declared_range') }}: {{ declaredRange }}</span>
        <span v-if="resolvedVersion" class="ms-2">
          · {{ $t('deps_stats.stats.resolved_version') }}: {{ resolvedVersion }}
        </span>
      </p>
    </div>
    <NuxtLink
      :to="statsLink"
      class="block font-mono text-xs text-fg-muted hover:text-fg underline-offset-2 hover:underline py-2 -my-2"
      v-if="statsLink"
    >
      {{ $t('deps_stats.stats.open_full_stats') }}
    </NuxtLink>
  </header>

  <div class="relative flex-1 overflow-y-auto">
    <div class="px-4 pt-4 space-y-3">
      <LicenseChangeWarning :change="licenseChangeData?.change ?? null" />
      <PackageReplacement
        v-if="moduleReplacement"
        :mapping="moduleReplacement.mapping"
        :replacement="moduleReplacement.replacement"
      />
      <PackageSizeIncrease v-if="sizeDiff?.direction === 'increase'" :diff="sizeDiff" />
      <PackageSizeDecrease v-else-if="sizeDiff?.direction === 'decrease'" :diff="sizeDiff" />
      <ClientOnly>
        <PackageVulnerabilityTree
          v-if="resolvedVersion"
          :package-name="packageName"
          :version="resolvedVersion"
        />
        <PackageDeprecatedTree
          v-if="resolvedVersion"
          :package-name="packageName"
          :version="resolvedVersion"
        />
      </ClientOnly>
    </div>

    <section class="px-4 py-6">
      <h3 class="text-fg-muted mb-2 uppercase text-sm">
        {{ $t('package.stats.main_information') }}
      </h3>
      <dl
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-2 gap-x-4 border-y-border border-y py-2"
      >
        <div v-for="row in facetRows" :key="row.id" class="py-1">
          <dt class="text-sm text-fg-muted lowercase">{{ row.label }}</dt>
          <dd class="text-sm font-mono mt-1">
            <span
              v-if="
                row.loading || status === 'pending' || (status === 'idle' && row.value === null)
              "
              aria-hidden="true"
              class="block w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full motion-safe:animate-spin"
            />
            <span v-else-if="!row.value" class="text-fg-subtle">–</span>
            <span v-else :title="formatFacetValue(row.value)" class="block truncate">{{
              formatFacetValue(row.value)
            }}</span>
          </dd>
        </div>
      </dl>
    </section>

    <div class="px-4 pb-10 space-y-10">
      <section>
        <h3 class="text-fg-muted mb-4 uppercase text-sm">
          {{ $t('package.stats.trends') }}
        </h3>
        <PackageTrendsChart
          class="font-mono"
          :package-names="[packageName]"
          :package-name="packageName"
          :version="resolvedVersion ?? undefined"
          show-facet-selector
          default-range="52-weeks"
        />
      </section>

      <section>
        <h3 class="text-fg-muted mb-4 uppercase text-sm">
          {{ $t('package.stats.version_distribution') }}
        </h3>
        <PackageVersionDistribution class="font-mono" :package-name="packageName" />
      </section>
    </div>
  </div>
</template>
