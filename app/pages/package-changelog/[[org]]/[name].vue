<script setup lang="ts">
import { useProviderIcon } from '~/composables/useProviderIcon'
/// routing

const route = useRoute('changelog')
// Parse package name & version
// Patterns:
//   /package-changelog/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0"
//   /package-changelog/nuxt/v/4.2.0/src/index.ts → packageName: "nuxt", version: "4.2.0"
//   /package-changelog/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0"
const parsedRoute = computed(() => {
  const { org, name } = route.params

  const packageName = org ? `${org}/${name}` : name

  // TODO: drop once nuxt emits child route names in `RouteRecordInfo` again. Since 4.5.2 the
  // child arg is `never`, so `useRoute('changelog')` doesn't union in the `changelog-version`
  // params and `version` widens to `unknown`.
  // @ts-expect-error see above
  const version: string | null = 'version' in route.params ? route.params.version : null

  return { packageName, version }
})

const packageName = computed(() => parsedRoute.value.packageName)
const requestedVersion = computed(() => parsedRoute.value.version)

const nuxtApp = useNuxtApp()

if (import.meta.server && packageName.value) {
  assertValidPackageName(packageName.value)
}

const {
  data: version,
  pending: resolvingPending,
  error: resolvingError,
} = await useResolvedVersion(packageName, requestedVersion, { server: false })

const packageRequest = usePackage(
  packageName,
  () => version.value ?? requestedVersion.value ?? null,
  { lazy: false, server: false },
)
const { data: pkg } = packageRequest

const versionUrlPattern = computed(() => {
  return `/package-changelog/${packageName.value}/v/{version}`
})

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

// getting info
const {
  data: changelog,
  error: changelogError,
  status: changelogStatus,
} = usePackageChangelog(() => (resolvingError.value ? '' : packageName.value), version, {
  server: false,
})

const showChangelogLoading = computed(
  () =>
    !changelog.value &&
    !changelogError.value &&
    (changelogStatus.value === 'pending' || changelogStatus.value === 'idle'),
)

const providerIcon = useProviderIcon(() => changelog.value?.provider)
const viewOnProvider = useViewOnGitProvider(() => changelog.value?.provider)

provide('changelog-provider-linkattr', {
  providerIcon,
  viewOnProvider,
})

const tptoc = useTemplateRef('tptoc')

const versionDate = computed(() => {
  if (!version.value) {
    return
  }
  const time = pkg.value?.time[version.value]
  if (time) {
    return new Date(time).toISOString().split('T')[0]
  }
})

const packageHeaderHeight = usePackageHeaderHeight()
const stickyStyle = computed(() => {
  return {
    '--combined-header-height': `${50 + (packageHeaderHeight.value || 44)}px`,
  }
})

// command pallet
const { versions: commandPaletteVersions, ensureLoaded: ensureCommandPaletteVersionsLoaded } =
  useCommandPalettePackageVersions(packageName)

const commandPalettePackageContext = computed(() => {
  const packageData = pkg.value
  if (!packageData) return null

  return {
    packageName: packageData.name,
    resolvedVersion: version.value ?? packageData['dist-tags']?.latest ?? null,
    latestVersion: packageData['dist-tags']?.latest ?? null,
    versions: commandPaletteVersions.value ?? Object.keys(packageData.versions ?? {}),
    tarballUrl: packageData.requestedVersion?.dist.tarball ?? null,
  }
})

useCommandPalettePackageContext(commandPalettePackageContext, {
  onOpen: ensureCommandPaletteVersionsLoaded,
})
useCommandPalettePackageCommands(commandPalettePackageContext)

const { t } = useI18n()

const pagePackageLabel = computed(() =>
  requestedVersion.value ? `${packageName.value}@${requestedVersion.value}` : packageName.value,
)
const pageTitle = computed(() => t('changelog.page_title', { name: pagePackageLabel.value }))
const pageDescription = computed(() =>
  t('changelog.meta_description', { name: pagePackageLabel.value }),
)

useSeoMeta({
  title: () => pageTitle.value,
  ogTitle: () => pageTitle.value,
  twitterTitle: () => pageTitle.value,
  description: () => pageDescription.value,
  ogDescription: () => pageDescription.value,
  twitterDescription: () => pageDescription.value,
})

if (import.meta.server) {
  defineOgImage(
    'Package.takumi',
    {
      name: () => packageName.value,
      version: () => requestedVersion.value,
      variant: 'download-chart',
    },
    { alt: () => `npm package ${packageName.value} download chart and stats` },
  )
}

if (nuxtApp.isHydrating && !resolvingError.value) {
  await packageRequest
}
</script>
<template>
  <main
    class="flex-1 flex flex-col min-h-[calc(100dvh-3.5rem)]"
    :style="stickyStyle"
    v-if="!resolvingError"
  >
    <PackageHeader
      page="changelog"
      :versionUrlPattern
      :pkg
      :latestVersion
      :resolved-version="version"
      :display-version="pkg?.requestedVersion"
    />
    <section class="container w-full pt-3">
      <div
        class="pa-3 z-2 flex justify-between gap-4 h-14 b-b-1 border-border bg-bg top-[--combined-header-height]"
        :class="{
          sticky: changelog?.type === 'md',
        }"
      >
        <LinkBase
          v-if="changelog?.link"
          :to="changelog?.link"
          :classicon="providerIcon"
          :title="viewOnProvider"
        >
          {{ changelog.provider }}
        </LinkBase>
        <div v-if="changelog?.type === 'md'" ref="tptoc" class="min-w-[150px] h-8 flex gap-2">
          <!-- Placeholder for toc & copy md -->
        </div>
      </div>
      <section v-if="showChangelogLoading" class="flex flex-col gap-2 py-3">
        <ChangelogSkeleton />
      </section>

      <LazyChangelogReleases
        v-if="changelog?.type === 'release'"
        :info="changelog"
        :requested-date="versionDate"
        :goToVersion="requestedVersion && version"
        :resolveVersionPending="resolvingPending"
        #error="{ error }"
      >
        <LazyChangelogErrorMsg
          :pkgName="pkg?.name"
          :changelog-link="changelog.link"
          :viewOnGit="viewOnProvider"
          :error="error"
        />
      </LazyChangelogReleases>
      <LazyChangelogMarkdown
        v-else-if="changelog?.type === 'md'"
        :info="changelog"
        :tpTarget="tptoc"
        :goToVersion="requestedVersion && version"
        :resolveVersionPending="resolvingPending"
        #error
      >
        <LazyChangelogErrorMsg
          :pkgName="pkg?.name"
          :changelog-link="changelog.link"
          :viewOnGit="viewOnProvider"
        />
      </LazyChangelogMarkdown>

      <!-- error handling -->
      <template v-else-if="!showChangelogLoading">
        <div v-if="isUnghRateLimitError(changelogError)" class="items-center flex flex-col">
          <p class="mt-5">{{ $t('changelog.ungh.rate_limit') }}</p>
          <p>{{ $t('changelog.ungh.hint') }}</p>
          <LinkBase
            variant="button-secondary"
            to="https://github.com/apps/ungh-app"
            classicon="i-simple-icons:github"
            >{{ $t('changelog.ungh.install') }}</LinkBase
          >
        </div>
        <p class="mt-5" v-else-if="!version || !pkg?.versions[version]">
          {{ $t('changelog.version_unavailable') }}
        </p>
        <p class="mt-5" v-else>
          {{ $t('changelog.no_logs') }}
        </p>
      </template>
    </section>
  </main>
  <!-- resolving the version didn't succeed, assunming that the package doesn't exist -->
  <main v-else role="alert" class="flex flex-col items-center py-20 text-center container w-full">
    <h1 class="font-mono text-2xl font-medium mb-4">
      {{ $t('package.not_found') }}
    </h1>
    <p class="text-fg-muted mb-8">
      {{ $t('package.not_found_message') }}
    </p>
    <LinkBase variant="button-secondary" :to="{ name: 'index' }">{{
      $t('common.go_back_home')
    }}</LinkBase>
  </main>
</template>
