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

  const version = 'version' in route.params ? route.params.version : null

  return { packageName, version }
})

const packageName = computed(() => parsedRoute.value.packageName)
const requestedVersion = computed(() => parsedRoute.value.version)

if (import.meta.server) {
  assertValidPackageName(packageName.value)
}

const {
  data: version,
  pending: resolvingPending,
  error: resolvingError,
} = await useResolvedVersion(packageName, requestedVersion)

const { data: pkg } = usePackage(packageName, () => version.value ?? requestedVersion.value ?? null)

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
const { data: changelog, error: changelogError } = usePackageChangelog(packageName, version)

const repoProviderIcon = useProviderIcon(() => changelog.value?.provider)
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

const viewOnGit = useViewOnGitProvider(() => changelog.value?.provider)

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

// og image
defineOgImage(
  'Page.takumi',
  {
    title: () => `${packageName.value ?? 'Package'} - Changelogs`,
  },
  { alt: () => `npm package ${packageName.value} changelogs` },
)
</script>
<template>
  <main class="flex-1 flex flex-col" :style="stickyStyle" v-if="!resolvingError">
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
          :classicon="repoProviderIcon"
          :title="viewOnGit"
        >
          {{ changelog.provider }}
        </LinkBase>
        <div v-if="changelog?.type === 'md'" ref="tptoc" class="w-14 h-8">
          <!-- prevents layout shift while loading -->
        </div>
      </div>
      <section v-if="!changelog && !changelogError" class="flex flex-col gap-2 py-3">
        <SkeletonBlock class="h-8 w-40 rounded" />
        <ul class="ms-3 list-disc my-4 ps-6 marker:color-[--border-hover]">
          <li class="mb-1" v-for="_n in 5">
            <SkeletonBlock class="h-7 w-full max-w-2xl rounded" />
          </li>
        </ul>

        <SkeletonBlock class="h-5 w-5/6 max-w-2xl rounded" />
        <SkeletonBlock class="h-5 w-3/4 max-w-2xl rounded" />
      </section>

      <Suspense v-else-if="changelog">
        <template #default>
          <LazyChangelogReleases
            v-if="changelog?.type === 'release'"
            :info="changelog"
            :requested-date="versionDate"
            :goToVersion="requestedVersion && version"
            :resolveVersionPending="resolvingPending"
            #error
          >
            <LazyChangelogErrorMsg
              :pkgName="pkg?.name"
              :changelog-link="changelog.link"
              :viewOnGit
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
              :viewOnGit
            />
          </LazyChangelogMarkdown>
        </template>
        <template #fallback>
          <section class="flex flex-col gap-2 py-3">
            <SkeletonBlock class="h-8 w-40 rounded" />
            <ul class="ms-3 list-disc my-[1rem] ps-[1.5rem] marker:color-border-hover">
              <li class="mb-1" v-for="_n in 5">
                <SkeletonBlock class="h-7 w-full max-w-2xl rounded" />
              </li>
            </ul>

            <SkeletonBlock class="h-5 w-5/6 max-w-2xl rounded" />
            <SkeletonBlock class="h-5 w-3/4 max-w-2xl rounded" />
          </section>
        </template>
      </Suspense>
      <!-- error handling -->
      <p class="mt-5" v-else-if="changelogError?.statusMessage == ERROR_UNGH_API_KEY_EXHAUSTED">
        {{ $t('changelog.rate_limit_ungh') }}
      </p>
      <p class="mt-5" v-else-if="!version || !pkg?.versions[version]">
        {{ $t('changelog.version_unavailable') }}
      </p>
      <p class="mt-5" v-else>
        {{ $t('changelog.no_logs') }}
      </p>
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
