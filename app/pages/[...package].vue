<script setup lang="ts">
import type { NpmVersionDist, PackumentVersion, ReadmeResponse } from '#shared/types'
import type { JsrPackageInfo } from '#shared/types/jsr'
import { assertValidPackageName } from '#shared/utils/npm'
import { onKeyStroke } from '@vueuse/core'
import { joinURL } from 'ufo'
import { areUrlsEquivalent } from '#shared/utils/url'

definePageMeta({
  name: 'package',
  alias: ['/package/:package(.*)*'],
})

const route = useRoute('package')

const router = useRouter()

// Parse package name and optional version from URL
// Patterns:
//   /nuxt → packageName: "nuxt", requestedVersion: null
//   /nuxt/v/4.2.0 → packageName: "nuxt", requestedVersion: "4.2.0"
//   /@nuxt/kit → packageName: "@nuxt/kit", requestedVersion: null
//   /@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", requestedVersion: "1.0.0"
//   /axios@1.13.3 → packageName: "axios", requestedVersion: "1.13.3"
//   /@nuxt/kit@1.0.0 → packageName: "@nuxt/kit", requestedVersion: "1.0.0"
const parsedRoute = computed(() => {
  const segments = route.params.package || []

  // Find the /v/ separator for version
  const vIndex = segments.indexOf('v')
  if (vIndex !== -1 && vIndex < segments.length - 1) {
    return {
      packageName: segments.slice(0, vIndex).join('/'),
      requestedVersion: segments.slice(vIndex + 1).join('/'),
    }
  }

  // Parse @ versioned package
  const fullPath = segments.join('/')
  const versionMatch = fullPath.match(/^(@[^/]+\/[^/]+|[^/]+)@([^/]+)$/)
  if (versionMatch) {
    const [, packageName, requestedVersion] = versionMatch as [string, string, string]
    return {
      packageName,
      requestedVersion,
    }
  }

  return {
    packageName: fullPath,
    requestedVersion: null as string | null,
  }
})

const packageName = computed(() => parsedRoute.value.packageName)
const requestedVersion = computed(() => parsedRoute.value.requestedVersion)

if (import.meta.server) {
  assertValidPackageName(packageName.value)
}

// Extract org name from scoped package (e.g., "@nuxt/kit" -> "nuxt")
const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

const { data: pkg, status, error, resolvedVersion } = usePackage(packageName, requestedVersion)

const { data: downloads } = usePackageDownloads(packageName, 'last-week')
const { data: weeklyDownloads } = usePackageWeeklyDownloadEvolution(packageName, { weeks: 52 })

// Fetch README for specific version if requested, otherwise latest
const { data: readmeData } = useLazyFetch<ReadmeResponse>(
  () => {
    const base = `/api/registry/readme/${packageName.value}`
    const version = requestedVersion.value
    return version ? `${base}/v/${version}` : base
  },
  { default: () => ({ html: '', playgroundLinks: [] }) },
)

// Check if package exists on JSR (only for scoped packages)
const { data: jsrInfo } = useLazyFetch<JsrPackageInfo>(() => `/api/jsr/${packageName.value}`, {
  default: () => ({ exists: false }),
  // Only fetch for scoped packages (JSR requirement)
  immediate: computed(() => packageName.value.startsWith('@')).value,
})

// Fetch total install size (lazy, can be slow for large dependency trees)
interface InstallSizeResult {
  package: string
  version: string
  selfSize: number
  totalSize: number
  dependencyCount: number
}
const {
  data: installSize,
  status: installSizeStatus,
  execute: fetchInstallSize,
} = useLazyFetch<InstallSizeResult | null>(
  () => {
    const base = `/api/registry/install-size/${packageName.value}`
    const version = requestedVersion.value
    return version ? `${base}/v/${version}` : base
  },
  {
    server: false,
    immediate: false,
  },
)
onMounted(() => fetchInstallSize())

const sizeTooltip = computed(() => {
  const chunks = [
    displayVersion.value &&
      displayVersion.value.dist.unpackedSize &&
      `${formatBytes(displayVersion.value.dist.unpackedSize)} unpacked size (this package)`,
    installSize.value &&
      installSize.value.dependencyCount &&
      `${formatBytes(installSize.value.totalSize)} total unpacked size (including all ${installSize.value.dependencyCount} dependencies for linux-x64)`,
  ]
  return chunks.filter(Boolean).join('\n')
})

// Get the version to display (resolved version or latest)
const displayVersion = computed(() => {
  if (!pkg.value) return null

  // Use resolved version if available
  if (resolvedVersion.value) {
    return pkg.value.versions[resolvedVersion.value] ?? null
  }

  // Fallback to latest
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

// Keep latestVersion for comparison (to show "(latest)" badge)
const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const deprecationNotice = computed(() => {
  if (!displayVersion.value?.deprecated) return null

  const isLatestDeprecated = !!latestVersion.value?.deprecated

  // If latest is deprecated, show "package deprecated"
  if (isLatestDeprecated) {
    return { type: 'package' as const, message: displayVersion.value.deprecated }
  }

  // Otherwise show "version deprecated"
  return { type: 'version' as const, message: displayVersion.value.deprecated }
})

const hasDependencies = computed(() => {
  if (!displayVersion.value) return false
  const deps = displayVersion.value.dependencies
  const peerDeps = displayVersion.value.peerDependencies
  const optionalDeps = displayVersion.value.optionalDependencies
  return (
    (deps && Object.keys(deps).length > 0) ||
    (peerDeps && Object.keys(peerDeps).length > 0) ||
    (optionalDeps && Object.keys(optionalDeps).length > 0)
  )
})

const repositoryUrl = computed(() => {
  const repo = displayVersion.value?.repository
  if (!repo?.url) return null
  let url = normalizeGitUrl(repo.url)
  // append `repository.directory` for monorepo packages
  if (repo.directory) {
    url = joinURL(`${url}/tree/HEAD`, repo.directory)
  }
  return url
})

const { meta: repoMeta, repoRef, stars, starsLink, forks, forksLink } = useRepoMeta(repositoryUrl)

const PROVIDER_ICONS: Record<string, string> = {
  github: 'i-carbon-logo-github',
  gitlab: 'i-simple-icons-gitlab',
  bitbucket: 'i-simple-icons-bitbucket',
  codeberg: 'i-simple-icons-codeberg',
  gitea: 'i-simple-icons-gitea',
  gitee: 'i-simple-icons-gitee',
  sourcehut: 'i-simple-icons-sourcehut',
  tangled: 'i-custom-tangled',
}

const repoProviderIcon = computed(() => {
  const provider = repoRef.value?.provider
  if (!provider) return 'i-carbon-logo-github'
  return PROVIDER_ICONS[provider] ?? 'i-carbon-code'
})

const homepageUrl = computed(() => {
  const homepage = displayVersion.value?.homepage
  if (!homepage) return null

  // Don't show homepage if it's the same as the repository URL
  if (repositoryUrl.value && areUrlsEquivalent(homepage, repositoryUrl.value)) {
    return null
  }

  return homepage
})

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
    .replace(/^git@github\.com:/, 'https://github.com/')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function getDependencyCount(version: PackumentVersion | null): number {
  if (!version?.dependencies) return 0
  return Object.keys(version.dependencies).length
}

// Check if a version has provenance/attestations
// The dist object may have attestations that aren't in the base type
function hasProvenance(version: PackumentVersion | null): boolean {
  if (!version?.dist) return false
  const dist = version.dist as NpmVersionDist
  return !!dist.attestations
}

const selectedPM = useSelectedPackageManager()

const installCommandParts = computed(() => {
  if (!pkg.value) return []
  return getInstallCommandParts({
    packageName: pkg.value.name,
    packageManager: selectedPM.value,
    version: requestedVersion.value,
    jsrInfo: jsrInfo.value,
  })
})

const installCommand = computed(() => {
  if (!pkg.value) return ''
  return getInstallCommand({
    packageName: pkg.value.name,
    packageManager: selectedPM.value,
    version: requestedVersion.value,
    jsrInfo: jsrInfo.value,
  })
})

// Copy install command
const copied = ref(false)
async function copyInstallCommand() {
  if (!installCommand.value) return
  await navigator.clipboard.writeText(installCommand.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

// Expandable description
const descriptionExpanded = ref(false)
const descriptionRef = ref<HTMLDivElement>()
const descriptionOverflows = ref(false)

// Check if description overflows on mount/update
function checkDescriptionOverflow() {
  if (descriptionRef.value) {
    const paragraph = descriptionRef.value.querySelector('p')
    if (paragraph) {
      // Compare scrollHeight to the fixed container height (3 lines ~= 72px)
      descriptionOverflows.value = paragraph.scrollHeight > 72
    }
  }
}

watch(
  () => pkg.value?.description,
  () => {
    descriptionExpanded.value = false
    nextTick(checkDescriptionOverflow)
  },
)

onMounted(() => {
  nextTick(checkDescriptionOverflow)
})

// Canonical URL for this package page
const canonicalUrl = computed(() => {
  const base = `https://npmx.dev/${packageName.value}`
  return requestedVersion.value ? `${base}/v/${requestedVersion.value}` : base
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: () => (pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx'),
  description: () => pkg.value?.description ?? '',
})

onKeyStroke('.', () => {
  if (pkg.value && displayVersion.value) {
    router.push({
      name: 'code',
      params: {
        path: [pkg.value.name, 'v', displayVersion.value.version],
      },
    })
  }
})

defineOgImageComponent('Package', {
  name: () => pkg.value?.name ?? 'Package',
  version: () => displayVersion.value?.version ?? '',
  downloads: () => (downloads.value ? formatNumber(downloads.value.downloads) : ''),
  license: () => pkg.value?.license ?? '',
})
</script>

<template>
  <main class="container py-8 sm:py-12 overflow-hidden w-full">
    <PackageSkeleton v-if="status === 'pending'" />

    <article v-else-if="status === 'success' && pkg" class="animate-fade-in min-w-0">
      <!-- Package header -->
      <header class="mb-8 pb-8 border-b border-border">
        <div class="mb-4">
          <!-- Package name and version -->
          <div class="flex items-baseline gap-2 mb-1.5 sm:gap-3 sm:mb-2 flex-wrap min-w-0">
            <h1
              class="font-mono text-2xl sm:text-3xl font-medium min-w-0 break-words"
              :title="pkg.name"
            >
              <NuxtLink
                v-if="orgName"
                :to="{ name: 'org', params: { org: orgName } }"
                class="text-fg-muted hover:text-fg transition-colors duration-200"
                >@{{ orgName }}</NuxtLink
              ><span v-if="orgName">/</span
              >{{ orgName ? pkg.name.replace(`@${orgName}/`, '') : pkg.name }}
            </h1>
            <span
              v-if="displayVersion"
              class="inline-flex items-baseline gap-1.5 font-mono text-base sm:text-lg text-fg-muted shrink-0"
            >
              <!-- Version resolution indicator (e.g., "latest → 4.2.0") -->
              <template v-if="resolvedVersion !== requestedVersion">
                <span class="font-mono text-fg-muted text-sm">{{ requestedVersion }}</span>
                <span class="i-carbon-arrow-right w-3 h-3" aria-hidden="true" />
              </template>

              <NuxtLink
                v-if="resolvedVersion !== requestedVersion"
                :to="`/${pkg.name}/v/${displayVersion.version}`"
                title="View permalink for this version"
                >{{ displayVersion.version }}</NuxtLink
              >
              <span v-else>v{{ displayVersion.version }}</span>

              <a
                v-if="hasProvenance(displayVersion)"
                :href="`https://www.npmjs.com/package/${pkg.name}/v/${displayVersion.version}#provenance`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
                title="Verified provenance"
              >
                <span
                  class="i-solar-shield-check-outline w-3.5 h-3.5 shrink-0"
                  aria-hidden="true"
                />
              </a>
              <span
                v-if="
                  requestedVersion &&
                  latestVersion &&
                  displayVersion.version !== latestVersion.version
                "
                class="text-fg-subtle text-sm shrink-0"
                >(not latest)</span
              >
            </span>

            <!-- Package metrics (module format, types) -->
            <ClientOnly>
              <PackageMetricsBadges
                v-if="displayVersion"
                :package-name="pkg.name"
                :version="displayVersion.version"
                class="self-center ml-1 sm:ml-2"
              />
              <template #fallback>
                <ul class="flex items-center gap-1.5 self-center ml-1 sm:ml-2">
                  <li class="skeleton w-8 h-5 rounded" />
                  <li class="skeleton w-12 h-5 rounded" />
                </ul>
              </template>
            </ClientOnly>

            <a
              :href="`https://www.npmjs.com/package/${pkg.name}`"
              target="_blank"
              rel="noopener noreferrer"
              class="link-subtle font-mono text-sm inline-flex items-center gap-1.5 ml-auto shrink-0 self-center"
              title="View on npm"
            >
              <span class="i-carbon-logo-npm w-4 h-4" aria-hidden="true" />
              <span class="hidden sm:inline">npm</span>
              <span class="sr-only sm:hidden">View on npm</span>
            </a>
          </div>

          <!-- Fixed height description container to prevent CLS -->
          <div ref="descriptionRef" class="relative max-w-2xl min-h-[4.5rem]">
            <p
              v-if="pkg.description"
              class="text-fg-muted text-base m-0 overflow-hidden"
              :class="descriptionExpanded ? '' : 'max-h-[4.5rem]'"
            >
              <MarkdownText :text="pkg.description" />
            </p>
            <p v-else class="text-fg-subtle text-base m-0 italic">No description provided</p>
            <!-- Fade overlay with show more button - only when collapsed and overflowing -->
            <div
              v-if="pkg.description && descriptionOverflows && !descriptionExpanded"
              class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg via-bg/90 to-transparent flex items-end justify-end"
            >
              <button
                type="button"
                class="font-mono text-xs text-fg-muted hover:text-fg bg-bg px-1 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                @click="descriptionExpanded = true"
              >
                show more
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="deprecationNotice"
          class="border border-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-base text-red-400"
        >
          <h2 class="font-medium mb-2">
            {{
              deprecationNotice.type === 'package'
                ? 'This package has been deprecated.'
                : 'This version has been deprecated.'
            }}
          </h2>
          <p v-if="deprecationNotice.message" class="text-base m-0">
            <MarkdownText :text="deprecationNotice.message" />
          </p>
          <p v-else class="text-base m-0 italic">No reason provided</p>
        </div>

        <!-- Stats grid -->
        <dl class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mt-4 sm:mt-6">
          <div v-if="pkg.license" class="space-y-1">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">License</dt>
            <dd class="font-mono text-sm text-fg">
              {{ pkg.license }}
            </dd>
          </div>

          <div v-if="downloads" class="space-y-1">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">Weekly</dt>
            <dd class="font-mono text-sm text-fg flex items-center justify-start gap-2">
              {{ formatNumber(downloads.downloads) }}
              <a
                :href="`https://npm.chart.dev/${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1"
                title="View download trends"
              >
                <span class="i-carbon-chart-line w-3.5 h-3.5 inline-block" aria-hidden="true" />
                <span class="sr-only">View download trends</span>
              </a>
            </dd>
          </div>

          <div class="space-y-1">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">Deps</dt>
            <dd class="font-mono text-sm text-fg flex items-center justify-start gap-2">
              {{ getDependencyCount(displayVersion) }}
              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://npmgraph.js.org/?q=${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1"
                title="View dependency graph"
              >
                <span class="i-carbon-network-3 w-3.5 h-3.5 inline-block" aria-hidden="true" />
                <span class="sr-only">View dependency graph</span>
              </a>

              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://node-modules.dev/grid/depth#install=${pkg.name}${displayVersion?.version ? `@${displayVersion.version}` : ''}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1"
                title="Inspect dependency tree on node-modules.dev"
              >
                <span
                  class="i-solar-eye-scan-outline w-3.5 h-3.5 inline-block"
                  aria-hidden="true"
                />
                <span class="sr-only">Inspect dependency tree</span>
              </a>
            </dd>
          </div>

          <div class="space-y-1 sm:col-span-2">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider flex items-center gap-1">
              Install Size
              <span
                class="i-carbon-information w-3 h-3 text-fg-subtle"
                aria-hidden="true"
                :title="sizeTooltip"
              />
            </dt>
            <dd class="font-mono text-sm text-fg">
              <!-- Package size (greyed out) -->
              <span class="text-fg-muted">
                <span v-if="displayVersion?.dist?.unpackedSize">
                  {{ formatBytes(displayVersion.dist.unpackedSize) }}
                </span>
                <span v-else>-</span>
              </span>

              <!-- Separator and install size -->
              <span class="text-fg-subtle mx-1">/</span>

              <span
                v-if="installSizeStatus === 'pending'"
                class="inline-flex items-center gap-1 text-fg-subtle"
              >
                <span
                  class="i-carbon-circle-dash w-3 h-3 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              </span>
              <span v-else-if="installSize?.totalSize">
                {{ formatBytes(installSize.totalSize) }}
              </span>
              <span v-else class="text-fg-subtle">-</span>
            </dd>
          </div>

          <div v-if="pkg.time?.modified" class="space-y-1">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider sm:text-right">Updated</dt>
            <dd class="font-mono text-sm text-fg sm:text-right">
              <NuxtTime :datetime="pkg.time.modified" date-style="medium" />
            </dd>
          </div>
        </dl>

        <!-- Links -->
        <nav aria-label="Package links" class="mt-6">
          <ul class="flex flex-wrap items-center gap-3 sm:gap-4 list-none m-0 p-0">
            <li v-if="repositoryUrl">
              <a
                :href="repositoryUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="w-4 h-4" :class="repoProviderIcon" aria-hidden="true" />
                <span v-if="repoRef">
                  {{ repoRef.owner }}<span class="opacity-50">/</span>{{ repoRef.repo }}
                </span>
                <span v-else>repo</span>
              </a>
            </li>
            <li v-if="repositoryUrl && repoMeta && starsLink">
              <a
                :href="starsLink"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="w-4 h-4 i-carbon-star" aria-hidden="true" />
                {{ formatCompactNumber(stars, { decimals: 1 }) }}
              </a>
            </li>
            <li v-if="homepageUrl">
              <a
                :href="homepageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-link w-4 h-4" aria-hidden="true" />
                homepage
              </a>
            </li>
            <li v-if="displayVersion?.bugs?.url">
              <a
                :href="displayVersion.bugs.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-warning w-4 h-4" aria-hidden="true" />
                issues
              </a>
            </li>

            <li v-if="forks && forksLink">
              <a
                :href="forksLink"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-fork w-4 h-4" aria-hidden="true" />
                <span>
                  {{ formatCompactNumber(forks, { decimals: 1 }) }}
                  {{ forks === 1 ? 'fork' : 'forks' }}
                </span>
              </a>
            </li>

            <li v-if="jsrInfo?.exists && jsrInfo.url">
              <a
                :href="jsrInfo.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
                title="Also available on JSR"
              >
                <span class="i-simple-icons-jsr w-4 h-4" aria-hidden="true" />
                jsr
              </a>
            </li>
            <li class="sm:flex-grow">
              <a
                :href="`https://socket.dev/npm/package/${pkg.name}/overview/${displayVersion?.version ?? 'latest'}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-simple-icons-socket w-4 h-4" aria-hidden="true" />
                socket.dev
              </a>
            </li>

            <li v-if="displayVersion">
              <NuxtLink
                :to="{
                  name: 'code',
                  params: { path: [...pkg.name.split('/'), 'v', displayVersion.version] },
                }"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
                aria-keyshortcuts="."
              >
                code
                <kbd
                  class="hidden sm:inline-flex items-center justify-center w-4 h-4 text-xs bg-bg-muted border border-border rounded"
                  aria-hidden="true"
                >
                  .
                </kbd>
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </header>

      <!-- Security vulnerabilities warning -->
      <PackageVulnerabilities
        v-if="displayVersion"
        :package-name="pkg.name"
        :version="displayVersion.version"
      />

      <!-- Install command with package manager selector -->
      <section aria-labelledby="install-heading" class="mb-8">
        <div class="flex flex-wrap items-center justify-between mb-3">
          <h2 id="install-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
            Install
          </h2>
          <!-- Package manager tabs -->
          <div
            class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border rounded-md"
            role="tablist"
            aria-label="Package manager"
          >
            <ClientOnly>
              <button
                v-for="pm in packageManagers"
                :key="pm.id"
                role="tab"
                :aria-selected="selectedPM === pm.id"
                class="px-2 py-1 font-mono text-xs rounded transition-all duration-150"
                :class="
                  selectedPM === pm.id
                    ? 'bg-bg-elevated text-fg'
                    : 'text-fg-subtle hover:text-fg-muted'
                "
                @click="selectedPM = pm.id"
              >
                {{ pm.label }}
              </button>
              <template #fallback>
                <span
                  v-for="pm in packageManagers"
                  :key="pm.id"
                  class="px-2 py-1 font-mono text-xs rounded"
                  :class="pm.id === 'npm' ? 'bg-bg-elevated text-fg' : 'text-fg-subtle'"
                >
                  {{ pm.label }}
                </span>
              </template>
            </ClientOnly>
          </div>
        </div>
        <div class="relative group">
          <!-- Terminal-style install command -->
          <div class="bg-[#0d0d0d] border border-border rounded-lg overflow-hidden">
            <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
            </div>
            <div class="flex items-center gap-2 px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
              <span class="text-fg-subtle font-mono text-sm select-none">$</span>
              <code class="font-mono text-sm"
                ><ClientOnly
                  ><span
                    v-for="(part, i) in installCommandParts"
                    :key="i"
                    :class="i === 0 ? 'text-fg' : 'text-fg-muted'"
                    >{{ i > 0 ? ' ' : '' }}{{ part }}</span
                  ><template #fallback
                    ><span class="text-fg">npm</span
                    ><span class="text-fg-muted"> install {{ pkg.name }}</span></template
                  ></ClientOnly
                ></code
              >
            </div>
          </div>
          <button
            type="button"
            class="absolute top-3 right-3 px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 hover:(text-fg border-border-hover) active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            @click="copyInstallCommand"
          >
            {{ copied ? 'copied!' : 'copy' }}
          </button>
        </div>
      </section>

      <!-- Two column layout for sidebar content -->
      <div class="grid lg:grid-cols-3 gap-8">
        <!-- Main content (README) -->
        <div class="lg:col-span-2 order-2 lg:order-1 min-w-0">
          <section aria-labelledby="readme-heading">
            <h2 id="readme-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
              Readme
            </h2>
            <!-- eslint-disable vue/no-v-html -- HTML is sanitized server-side -->
            <div
              v-if="readmeData?.html"
              class="readme-content prose prose-invert max-w-none"
              v-html="readmeData.html"
            />
            <p v-else class="text-fg-subtle italic">
              No README available.
              <a v-if="repositoryUrl" :href="repositoryUrl" rel="noopener noreferrer" class="link"
                >View on GitHub</a
              >
            </p>
          </section>
        </div>

        <!-- Sidebar -->
        <div class="order-1 lg:order-2 space-y-6 sm:space-y-8 min-w-0 overflow-hidden">
          <!-- Maintainers (with admin actions when connected) -->
          <PackageMaintainers :package-name="pkg.name" :maintainers="pkg.maintainers" />

          <!-- Team access controls (for scoped packages when connected) -->
          <ClientOnly>
            <PackageAccessControls :package-name="pkg.name" />
          </ClientOnly>

          <!-- Keywords -->
          <section v-if="displayVersion?.keywords?.length" aria-labelledby="keywords-heading">
            <h2 id="keywords-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
              Keywords
            </h2>
            <ul class="flex flex-wrap gap-1.5 list-none m-0 p-0">
              <li v-for="keyword in displayVersion.keywords.slice(0, 15)" :key="keyword">
                <NuxtLink :to="{ name: 'search', query: { q: `keywords:${keyword}` } }" class="tag">
                  {{ keyword }}
                </NuxtLink>
              </li>
            </ul>
          </section>

          <!-- Download stats -->
          <PackageDownloadStats :downloads="weeklyDownloads" />

          <!-- Playground links -->
          <PackagePlaygrounds
            v-if="readmeData?.playgroundLinks?.length"
            :links="readmeData.playgroundLinks"
          />

          <section
            v-if="
              displayVersion?.engines && (displayVersion.engines.node || displayVersion.engines.npm)
            "
            aria-labelledby="compatibility-heading"
          >
            <h2
              id="compatibility-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Compatibility
            </h2>
            <dl class="space-y-2">
              <div v-if="displayVersion.engines.node" class="flex justify-between gap-4 py-1">
                <dt class="text-fg-muted text-sm shrink-0">node</dt>
                <dd
                  class="font-mono text-sm text-fg text-right"
                  :title="displayVersion.engines.node"
                >
                  {{ displayVersion.engines.node }}
                </dd>
              </div>
              <div v-if="displayVersion.engines.npm" class="flex justify-between gap-4 py-1">
                <dt class="text-fg-muted text-sm shrink-0">npm</dt>
                <dd
                  class="font-mono text-sm text-fg text-right"
                  :title="displayVersion.engines.npm"
                >
                  {{ displayVersion.engines.npm }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Versions (grouped by release channel) -->
          <PackageVersions
            v-if="pkg.versions && Object.keys(pkg.versions).length > 0"
            :package-name="pkg.name"
            :versions="pkg.versions"
            :dist-tags="pkg['dist-tags'] ?? {}"
            :time="pkg.time"
          />

          <!-- Install Scripts Warning -->
          <PackageInstallScripts
            v-if="displayVersion?.installScripts"
            :package-name="pkg.name"
            :install-scripts="displayVersion.installScripts"
          />

          <!-- Dependencies -->
          <PackageDependencies
            v-if="hasDependencies"
            :package-name="pkg.name"
            :dependencies="displayVersion?.dependencies"
            :peer-dependencies="displayVersion?.peerDependencies"
            :peer-dependencies-meta="displayVersion?.peerDependenciesMeta"
            :optional-dependencies="displayVersion?.optionalDependencies"
          />
        </div>
      </div>
    </article>

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-20 text-center">
      <h1 class="font-mono text-2xl font-medium mb-4">Package Not Found</h1>
      <p class="text-fg-muted mb-8">
        {{ error?.message ?? 'The package could not be found.' }}
      </p>
      <NuxtLink to="/" class="btn"> Go back home </NuxtLink>
    </div>
  </main>
</template>
