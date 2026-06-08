<script setup lang="ts">
definePageMeta({
  name: 'stats',
  path: '/package-stats/:org?/:packageName/v/:version',
  preserveScrollOnQuery: true,
})

const { locale } = useI18n()

const route = useRoute('stats')

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)
const version = computed(() => route.params.version)

const { data: pkg } = usePackage(packageName, version)
const { versions: commandPaletteVersions, ensureLoaded: ensureCommandPaletteVersionsLoaded } =
  useCommandPalettePackageVersions(packageName)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const commandPalettePackageContext = computed(() => {
  const packageData = pkg.value
  if (!packageData) return null

  return {
    packageName: packageData.name,
    resolvedVersion: version.value ?? packageData['dist-tags']?.latest ?? null,
    latestVersion: packageData['dist-tags']?.latest ?? null,
    versions: commandPaletteVersions.value ?? Object.keys(packageData.versions ?? {}),
  }
})

useCommandPalettePackageContext(commandPalettePackageContext, {
  onOpen: ensureCommandPaletteVersionsLoaded,
})
useCommandPalettePackageCommands(commandPalettePackageContext)

const versionUrlPattern = computed(() => {
  const { org, packageName: name } = route.params
  return `/package-stats/${org ? `${org}/` : ''}${name}/v/{version}`
})

useCommandPaletteVersionCommands(commandPalettePackageContext, nextVersion =>
  packageStatsRoute(packageName.value, nextVersion),
)

// Build a single comparison spec, pinning the requested version when present.
const comparisonSpecs = computed(() => [
  version.value ? `${packageName.value}@${version.value}` : packageName.value,
])

const { getFacetValues, isFacetLoading, isColumnLoading, status } =
  usePackageComparison(comparisonSpecs)

const { facetLabels } = useFacetSelection()

/** All facets rendered as a flat key/value list for the single package. */
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

useSeoMeta({
  title: () => `Stats - ${packageName.value} - npmx`,
  description: () => `Stats for ${packageName.value}`,
})
</script>

<template>
  <main class="flex-1 flex flex-col min-h-0">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="version"
      :display-version="pkg?.requestedVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="stats"
    />

    <section class="container w-full py-8">
      <h2 class="text-fg-muted mb-2 uppercase">{{ $t('package.stats.main_information') }}</h2>
      <dl
        class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-y-2 gap-x-4 border-y-border border-y py-2"
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
    <div class="container w-full flex max-lg:flex-col gap-8 pb-16">
      <div class="flex-1">
        <section id="trends">
          <h2 class="text-fg-muted mb-6 uppercase">{{ $t('package.stats.trends') }}</h2>
          <PackageTrendsChart
            class="font-mono"
            :package-names="[packageName]"
            :package-name="packageName"
            :version="version"
            show-facet-selector
            default-range="52-weeks"
            permalink
          />
        </section>
        <section id="distribution" class="mt-12">
          <h2 class="text-fg-muted mb-6 uppercase">
            {{ $t('package.stats.version_distribution') }}
          </h2>
          <PackageVersionDistribution class="font-mono" :package-name="packageName" />
        </section>
      </div>
      <PackageSidebar class="w-80">
        <div class="flex flex-col gap-4 sm:gap-6 lg:pt-4">
          <PackageMaintainers :package-name="packageName" :maintainers="pkg?.maintainers" />
          <PackageVersions
            v-if="pkg?.versions && Object.keys(pkg.versions).length > 0"
            :package-name="pkg.name"
            :versions="pkg?.versions"
            :dist-tags="pkg?.['dist-tags'] ?? {}"
            :time="pkg?.time"
            :selected-version="version ?? pkg?.['dist-tags']?.['latest']"
          />
        </div>
      </PackageSidebar>
    </div>
  </main>
</template>
