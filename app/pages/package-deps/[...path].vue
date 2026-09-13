<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { setResponseHeader } from 'h3'
import { DEFAULT_FILTERS } from '#shared/types/preferences'
import type { DepSectionId, DependencySortOption } from '#shared/types/package-dependencies'
import { assertValidPackageName } from '#shared/utils/npm'
import { normalizeSearchParam } from '#shared/utils/url'
import { debounce } from 'perfect-debounce'
import {
  getDefaultDependencySection,
  getPackageDependencySections,
  isDepSectionId,
  getNormalizedDependenciesFromPackageVersion,
} from '~/utils/npm/package-dependency-sections'
import { getVulnerableDepInfo, getDeprecatedDepInfo } from '~/utils/npm/problematic-dependencies'

definePageMeta({
  name: 'dependencies',
  path: '/package-deps/:path+',
  alias: ['/package/dependencies/:path+', '/dependencies/:path+'],
  scrollMargin: 160,
  preserveScrollOnQuery: true,
})

const route = useRoute('dependencies')
const router = useRouter()

const { packageName, requestedVersion } = usePackageRoute()

if (import.meta.server && packageName.value) {
  assertValidPackageName(packageName.value)
}

const {
  data: resolvedVersion,
  status: resolvedStatus,
  pending: resolvedPending,
} = await useResolvedVersion(packageName, requestedVersion)

if (
  import.meta.server &&
  !resolvedVersion.value &&
  ['success', 'error'].includes(resolvedStatus.value)
) {
  throw createError({
    statusCode: 404,
    statusMessage: $t('package.not_found'),
    message: $t('package.not_found_message'),
  })
}

watch(
  [resolvedStatus, resolvedVersion],
  ([status, version]) => {
    if ((!version && status === 'success') || status === 'error') {
      showError({
        statusCode: 404,
        statusMessage: $t('package.not_found'),
        message: $t('package.not_found_message'),
      })
    }
  },
  { immediate: true },
)

const { data: pkg, status: pkgStatus } = await usePackage(
  packageName,
  () => resolvedVersion.value ?? requestedVersion.value,
)
const { versions: commandPaletteVersions, ensureLoaded: ensureCommandPaletteVersionsLoaded } =
  useCommandPalettePackageVersions(packageName)

const latestVersionTag = computed(() => pkg.value?.['dist-tags']?.latest ?? null)

if (import.meta.server && !requestedVersion.value && packageName.value) {
  const app = useNuxtApp()
  const latest = await fetchLatestVersion(packageName.value)
  if (latest) {
    setResponseHeader(useRequestEvent()!, 'Cache-Control', 'no-cache')
    app.runWithContext(() =>
      navigateTo(dependenciesRoute(packageName.value, latest), { redirectCode: 302 }),
    )
  }
}

watch(
  [requestedVersion, latestVersionTag, packageName],
  ([reqVer, latest, name]) => {
    if (!reqVer && latest && name) {
      router.replace(dependenciesRoute(name, latest))
    }
  },
  { immediate: true },
)

const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)

const isPkgLoading = computed(
  () => resolvedPending.value || pkgStatus.value === 'idle' || pkgStatus.value === 'pending',
)

const sections = computed(() => getPackageDependencySections(displayVersion.value))

const DEFAULT_SORT: DependencySortOption = 'name-asc'

function parseSectionsFromQuery(queryValue: unknown): string[] {
  if (!queryValue) return []
  const rawList = Array.isArray(queryValue) ? queryValue : [queryValue]
  const parsed: string[] = []
  for (const item of rawList) {
    if (typeof item === 'string') {
      const parts = item.split(',')
      for (const part of parts) {
        const trimmed = part.trim()
        if (isDepSectionId(trimmed) && !parsed.includes(trimmed)) {
          parsed.push(trimmed)
        }
      }
    }
  }
  return parsed
}

const filter = ref(normalizeSearchParam(route.query.q))
const initialQuerySort = normalizeSearchParam(route.query.sort) as DependencySortOption
const sort = ref<DependencySortOption>(
  [
    'name-asc',
    'name-desc',
    'downloads-week-asc',
    'downloads-week-desc',
    'updated-asc',
    'updated-desc',
  ].includes(initialQuerySort)
    ? initialQuerySort
    : DEFAULT_SORT,
)

const initialQuerySections = parseSectionsFromQuery(route.query.sections ?? route.query.section)
const activeSections = ref<string[]>(
  initialQuerySections.length > 0 ? initialQuerySections : ['dependencies'],
)

watch(
  sections,
  s => {
    if (s.length > 0) {
      const validActive = activeSections.value.filter(id => s.some(sec => sec.id === id))
      if (validActive.length === 0) {
        const defaultSec = getDefaultDependencySection(s)
        activeSections.value = defaultSec ? [defaultSec] : s.map(sec => sec.id)
      }
    }
  },
  { immediate: true },
)

const updateUrl = debounce(() => {
  const newQ = filter.value.trim() || undefined
  const newSort = sort.value !== DEFAULT_SORT ? sort.value : undefined

  const defaultSec =
    sections.value.length > 0 ? getDefaultDependencySection(sections.value) : 'dependencies'
  const isDefaultSections =
    activeSections.value.length === 1 && activeSections.value[0] === defaultSec
  const newSections = isDefaultSections ? undefined : activeSections.value.join(',')

  const currentQ = normalizeSearchParam(route.query.q) || undefined
  const currentSort = normalizeSearchParam(route.query.sort) || undefined
  const currentSections =
    parseSectionsFromQuery(route.query.sections ?? route.query.section).join(',') || undefined

  if (
    currentQ !== newQ ||
    currentSort !== newSort ||
    currentSections !== newSections ||
    route.query.section !== undefined
  ) {
    const query = { ...route.query }
    delete query.section
    if (newQ) query.q = newQ
    else delete query.q

    if (newSort) query.sort = newSort
    else delete query.sort

    if (newSections) query.sections = newSections
    else delete query.sections

    router.replace({ query })
  }
}, 300)

watch([filter, sort, activeSections], () => {
  updateUrl()
})

watch(
  () => route.query,
  newQuery => {
    const qFromUrl = normalizeSearchParam(newQuery.q)
    if (filter.value !== qFromUrl) {
      filter.value = qFromUrl
    }

    const sortFromUrl = normalizeSearchParam(newQuery.sort) as DependencySortOption
    const validSort = [
      'name-asc',
      'name-desc',
      'downloads-week-asc',
      'downloads-week-desc',
      'updated-asc',
      'updated-desc',
    ].includes(sortFromUrl)
      ? sortFromUrl
      : DEFAULT_SORT
    if (sort.value !== validSort) {
      sort.value = validSort
    }

    const sectionsFromUrl = parseSectionsFromQuery(newQuery.sections ?? newQuery.section)
    if (sectionsFromUrl.length > 0) {
      const isSame =
        sectionsFromUrl.length === activeSections.value.length &&
        sectionsFromUrl.every((sec, i) => sec === activeSections.value[i])
      if (!isSame) {
        activeSections.value = sectionsFromUrl
      }
    }
  },
)

onBeforeUnmount(() => {
  updateUrl.cancel()
})

const currentSections = computed(() =>
  sections.value.filter(s => activeSections.value.includes(s.id)),
)

const allSectionItems = computed(() => {
  return currentSections.value.flatMap(s => s.items)
})

const allDependencies = computed(() => {
  return getNormalizedDependenciesFromPackageVersion(pkg.value?.requestedVersion)
})

const versionUrlPattern = computed(() => {
  const base = `/package-deps/${pkg.value?.name || packageName.value}/v/{version}`
  const secs = activeSections.value.join(',')
  return secs ? `${base}?sections=${secs}` : base
})

function depsVersionRoute(nextVersion: string): RouteLocationRaw {
  return dependenciesRoute(packageName.value, nextVersion, activeSections.value as DepSectionId[])
}

const commandPalettePackageContext = computed(() => {
  const packageData = pkg.value
  if (!packageData) return null

  return {
    packageName: packageData.name,
    resolvedVersion: resolvedVersion.value ?? packageData['dist-tags']?.latest ?? null,
    latestVersion: packageData['dist-tags']?.latest ?? null,
    versions: commandPaletteVersions.value ?? Object.keys(packageData.versions ?? {}),
  }
})

useCommandPalettePackageContext(commandPalettePackageContext, {
  onOpen: ensureCommandPaletteVersionsLoaded,
})
useCommandPalettePackageCommands(commandPalettePackageContext)
useCommandPaletteVersionCommands(commandPalettePackageContext, depsVersionRoute)

const insights = usePackageDependencyInsights(packageName, resolvedVersion, allDependencies)

const { viewMode, columns, toggleColumn, resetColumns } = usePackageListPreferences()

const selectedInsights = ref<string[]>([])

const packageMetaCache = usePackageMetaState()

watch(
  allSectionItems,
  items => {
    if (!items) return
    for (const item of items) {
      const targetName = item.packageName || item.name
      if (packageMetaCache.value[targetName]) continue
      fetchPackageMeta(targetName).catch(() => {})
    }
  },
  { immediate: true },
)

const filteredItems = computed(() => {
  const items = allSectionItems.value
  const query = filter.value.trim().toLowerCase()
  let result = query
    ? items.filter(
        item =>
          item.name.toLowerCase().includes(query) || item.packageName.toLowerCase().includes(query),
      )
    : [...items]

  if (selectedInsights.value.length > 0) {
    result = result.filter(item => {
      const targetName = item.packageName || item.name
      const outdated = insights.outdatedDeps.value?.[item.name]
      return selectedInsights.value.some(id => {
        switch (id) {
          case 'major':
            return outdated ? outdated.majorsBehind > 0 : false
          case 'minor':
            return outdated ? outdated.majorsBehind === 0 && outdated.minorsBehind > 0 : false
          case 'patch':
            return outdated
              ? outdated.majorsBehind === 0 &&
                  outdated.minorsBehind === 0 &&
                  outdated.resolved !== outdated.latest
              : false
          case 'vulnerable':
            return !!getVulnerableDepInfo(targetName, insights.vulnTree.value)
          case 'deprecated':
            return !!getDeprecatedDepInfo(targetName, insights.vulnTree.value)
          case 'replacement':
            return !!insights.replacementDeps.value?.[item.name]
          default:
            return false
        }
      })
    })
  }

  result.sort((a, b) => {
    const metaA = packageMetaCache.value[a.packageName || a.name]
    const metaB = packageMetaCache.value[b.packageName || b.name]

    switch (sort.value) {
      case 'name-desc':
        return b.name.localeCompare(a.name)
      case 'downloads-week-desc':
        return (metaB?.weeklyDownloads ?? 0) - (metaA?.weeklyDownloads ?? 0)
      case 'downloads-week-asc':
        return (metaA?.weeklyDownloads ?? 0) - (metaB?.weeklyDownloads ?? 0)
      case 'updated-desc':
        return (
          (metaB?.date ? Date.parse(metaB.date) : 0) - (metaA?.date ? Date.parse(metaA.date) : 0)
        )
      case 'updated-asc':
        return (
          (metaA?.date ? Date.parse(metaA.date) : 0) - (metaB?.date ? Date.parse(metaB.date) : 0)
        )
      default:
        return a.name.localeCompare(b.name)
    }
  })

  return result
})

const isInsightsLoading = computed(() => {
  if (selectedInsights.value.length === 0) return false
  return selectedInsights.value.some(id => {
    if (['major', 'minor', 'patch'].includes(id)) {
      return insights.outdatedStatus.value === 'pending' || insights.outdatedStatus.value === 'idle'
    }
    if (['vulnerable', 'deprecated'].includes(id)) {
      return insights.vulnStatus.value === 'pending' || insights.vulnStatus.value === 'idle'
    }
    if (id === 'replacement') {
      return (
        insights.replacementStatus.value === 'pending' ||
        insights.replacementStatus.value === 'idle'
      )
    }
    return false
  })
})

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

useSeoMeta({
  title: () =>
    pkg.value && resolvedVersion.value
      ? `${pkg.value.name}@${resolvedVersion.value} dependencies - npmx`
      : 'Dependencies - npmx',
})

const showSkeleton = shallowRef(false)

const { model: globalSearchModel } = useGlobalSearch()

const structuredFilters = computed(() => {
  const parsed = parseSearchOperators(globalSearchModel.value)
  return {
    ...DEFAULT_FILTERS,
    keywords: parsed.keywords ?? [],
    text: parsed.text ?? '',
  }
})

function handleKeywordClick(keyword: string) {
  const currentQuery = globalSearchModel.value.trim()
  const parsed = parseSearchOperators(currentQuery)
  const alreadyExists = parsed.keywords?.includes(keyword)

  let queryStr: string
  if (alreadyExists) {
    queryStr = removeKeywordFromQuery(currentQuery, keyword)
  } else if (currentQuery) {
    queryStr = `${currentQuery} keyword:${keyword}`
  } else {
    queryStr = `keyword:${keyword}`
  }

  globalSearchModel.value = queryStr
}

const unselectedSectionsWithMatchingItems = computed(() => {
  if (selectedInsights.value.length === 0) return []

  const unselectedSections = sections.value.filter(s => !activeSections.value.includes(s.id))
  if (unselectedSections.length === 0) return []

  const matchingSections: typeof sections.value = []

  for (const section of unselectedSections) {
    const hasMatch = section.items.some(item => {
      const targetName = item.packageName || item.name
      const outdated = insights.outdatedDeps.value?.[item.name]
      return selectedInsights.value.some(id => {
        switch (id) {
          case 'major':
            return outdated ? outdated.majorsBehind > 0 : false
          case 'minor':
            return outdated ? outdated.majorsBehind === 0 && outdated.minorsBehind > 0 : false
          case 'patch':
            return outdated
              ? outdated.majorsBehind === 0 &&
                  outdated.minorsBehind === 0 &&
                  outdated.resolved !== outdated.latest
              : false
          case 'vulnerable':
            return !!getVulnerableDepInfo(targetName, insights.vulnTree.value)
          case 'deprecated':
            return !!getDeprecatedDepInfo(targetName, insights.vulnTree.value)
          case 'replacement':
            return !!insights.replacementDeps.value?.[item.name]
          default:
            return false
        }
      })
    })

    if (hasMatch) {
      matchingSections.push(section)
    }
  }

  return matchingSections
})

function enableUnselectedSections() {
  const idsToAdd = unselectedSectionsWithMatchingItems.value.map(s => s.id)
  activeSections.value = Array.from(new Set([...activeSections.value, ...idsToAdd]))
}
</script>

<template>
  <DevOnly>
    <ButtonBase
      class="fixed bottom-4 inset-is-4 z-50 shadow-lg rounded-full! px-3! py-2!"
      classicon="i-simple-icons:skeleton"
      variant="primary"
      title="Toggle skeleton loader (development only)"
      :aria-pressed="showSkeleton"
      @click="showSkeleton = !showSkeleton"
    >
      <span class="text-xs">Skeleton</span>
    </ButtonBase>
  </DevOnly>
  <main class="flex-1 pb-8">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="resolvedVersion"
      :display-version="displayVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="dependencies"
    />

    <div v-if="isPkgLoading" class="container py-20 text-center">
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
    </div>

    <div
      v-else-if="pkgStatus === 'error' || resolvedStatus === 'error'"
      role="alert"
      class="flex flex-col items-center py-20 text-center container w-full"
    >
      <h1 class="font-mono text-2xl font-medium mb-4">
        {{ $t('package.not_found') }}
      </h1>
      <p class="text-fg-muted mb-8">
        {{ $t('package.not_found_message') }}
      </p>
      <LinkBase variant="button-secondary" :to="{ name: 'index' }">{{
        $t('common.go_back_home')
      }}</LinkBase>
    </div>

    <div
      v-else-if="sections.length === 0 && pkgStatus === 'success' && resolvedStatus === 'success'"
      class="container py-20 text-center"
    >
      <p class="text-fg-muted mb-4">{{ $t('package.dependencies.none') }}</p>
      <LinkBase variant="button-secondary" :to="packageRoute(packageName, requestedVersion)">{{
        $t('code.back_to_package')
      }}</LinkBase>
    </div>

    <article v-else-if="sections.length > 0" id="package-article" class="container w-full">
      <DependenciesInsightsSummary
        v-model:selected-insights="selectedInsights"
        :sections="sections"
        :show-skeleton="showSkeleton"
        :insights="insights"
        :package-name="packageName"
      />

      <div class="py-4">
        <DependenciesToolbar
          v-model:filter="filter"
          v-model:sort="sort"
          v-model:view-mode="viewMode"
          v-model:active-sections="activeSections"
          :columns="columns"
          :filtered-count="filteredItems.length"
          :total-count="allSectionItems.length"
          :sections="sections"
          @toggle-column="toggleColumn"
          @reset-columns="resetColumns"
        />

        <div
          v-if="unselectedSectionsWithMatchingItems.length > 0"
          class="my-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-mono flex items-center justify-between gap-2"
        >
          <div class="flex items-center gap-2">
            <span
              class="i-lucide:triangle-alert w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <span>{{
              $t('package.dependencies.insights.unselected_sections_warning', {
                sections: unselectedSectionsWithMatchingItems.map(s => s.id).join(', '),
              })
            }}</span>
          </div>
          <button
            type="button"
            class="underline font-sans font-medium hover:text-fg transition-colors cursor-pointer shrink-0"
            @click="enableUnselectedSections"
          >
            {{ $t('package.dependencies.insights.enable_sections') }}
          </button>
        </div>

        <div v-if="isInsightsLoading" class="py-12 text-center">
          <div class="i-svg-spinners:ring-resize w-6 h-6 mx-auto text-fg-muted" />
        </div>

        <DependenciesList
          v-else-if="filteredItems.length > 0"
          :items="filteredItems"
          :view-mode="viewMode"
          :columns="columns"
          :show-skeleton="showSkeleton"
          :sort="sort"
          :insights="insights"
          :filters="structuredFilters"
          @update:sort="sort = $event"
          @click-keyword="handleKeywordClick"
        />

        <p v-else class="py-12 text-center text-fg-subtle font-mono text-sm">
          {{ $t('package.dependencies.no_matches') }}
        </p>
      </div>
    </article>
  </main>
</template>
