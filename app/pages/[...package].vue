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

const router = useRouter()

const { packageName, requestedVersion, orgName } = usePackageRoute()
const selectedPM = useSelectedPackageManager()
const activePmId = computed(() => selectedPM.value ?? 'npm')

if (import.meta.server) {
  assertValidPackageName(packageName.value)
}

const { data: downloads } = usePackageDownloads(packageName, 'last-week')

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

const { data: packageAnalysis } = usePackageAnalysis(packageName, requestedVersion)
const { data: moduleReplacement } = useModuleReplacement(packageName)

const { data: pkg, status, error } = await usePackage(packageName, requestedVersion)
const resolvedVersion = computed(() => pkg.value?.resolvedVersion ?? null)

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

// Fetch dependency analysis (lazy, client-side)
// This is the same composable used by PackageVulnerabilityTree and PackageDeprecatedTree
const {
  data: vulnTree,
  status: vulnTreeStatus,
  fetch: fetchVulnTree,
} = useDependencyAnalysis(packageName, () => displayVersion.value?.version ?? '')
onMounted(() => {
  // Fetch vulnerability tree once displayVersion is available
  if (displayVersion.value) {
    fetchVulnTree()
  }
})
watch(
  () => displayVersion.value?.version,
  () => {
    if (displayVersion.value) {
      fetchVulnTree()
    }
  },
)

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

const sizeTooltip = computed(() => {
  const chunks = [
    displayVersion.value &&
      displayVersion.value.dist.unpackedSize &&
      $t('package.stats.size_tooltip.unpacked', {
        size: formatBytes(displayVersion.value.dist.unpackedSize),
      }),
    installSize.value &&
      installSize.value.dependencyCount &&
      $t('package.stats.size_tooltip.total', {
        size: formatBytes(installSize.value.totalSize),
        count: installSize.value.dependencyCount,
      }),
  ]
  return chunks.filter(Boolean).join('\n')
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

// Vulnerability count for the stats banner
const vulnCount = computed(() => vulnTree.value?.totalCounts.total ?? 0)
const hasVulnerabilities = computed(() => vulnCount.value > 0)

// Total transitive dependencies count (from either vuln tree or install size)
// Subtract 1 to exclude the root package itself
const totalDepsCount = computed(() => {
  if (vulnTree.value) {
    return vulnTree.value.totalPackages - 1
  }
  if (installSize.value) {
    return installSize.value.dependencyCount
  }
  return null
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
  github: 'i-carbon:logo-github',
  gitlab: 'i-simple-icons:gitlab',
  bitbucket: 'i-simple-icons:bitbucket',
  codeberg: 'i-simple-icons:codeberg',
  gitea: 'i-simple-icons:gitea',
  forgejo: 'i-simple-icons:forgejo',
  gitee: 'i-simple-icons:gitee',
  sourcehut: 'i-simple-icons:sourcehut',
  tangled: 'i-custom:tangled',
  radicle: 'i-carbon:network-3', // Radicle is a P2P network, using network icon
}

const repoProviderIcon = computed(() => {
  const provider = repoRef.value?.provider
  if (!provider) return 'i-carbon:logo-github'
  return PROVIDER_ICONS[provider] ?? 'i-carbon:code'
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

// Docs URL: use our generated API docs
const docsLink = computed(() => {
  if (!displayVersion.value) return null

  return {
    name: 'docs' as const,
    params: { path: [...pkg.value!.name.split('/'), 'v', displayVersion.value.version] },
  }
})

const fundingUrl = computed(() => {
  let funding = displayVersion.value?.funding
  if (Array.isArray(funding)) funding = funding[0]

  if (!funding) return null

  return typeof funding === 'string' ? funding : funding.url
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

// Get @types package name if available (non-deprecated)
const typesPackageName = computed(() => {
  if (!packageAnalysis.value) return null
  if (packageAnalysis.value.types.kind !== '@types') return null
  if (packageAnalysis.value.types.deprecated) return null
  return packageAnalysis.value.types.packageName
})

// Executable detection for run command
const executableInfo = computed(() => {
  if (!displayVersion.value || !pkg.value) return null
  return getExecutableInfo(pkg.value.name, displayVersion.value.bin)
})

// Detect if package is binary-only (show only execute commands, no install)
const isBinaryOnly = computed(() => {
  if (!displayVersion.value || !pkg.value) return false
  return isBinaryOnlyPackage({
    name: pkg.value.name,
    bin: displayVersion.value.bin,
    main: displayVersion.value.main,
    module: displayVersion.value.module,
    exports: displayVersion.value.exports,
  })
})

// Detect if package uses create-* naming convention
const isCreatePkg = computed(() => {
  if (!pkg.value) return false
  return isCreatePackage(pkg.value.name)
})

// Get associated create-* package info (e.g., vite -> create-vite)
const createPackageInfo = computed(() => {
  if (!packageAnalysis.value?.createPackage) return null
  // Don't show if deprecated
  if (packageAnalysis.value.createPackage.deprecated) return null
  return packageAnalysis.value.createPackage
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

onKeyStroke('d', () => {
  if (docsLink.value) {
    router.push(docsLink.value)
  }
})

defineOgImageComponent('Package', {
  name: () => pkg.value?.name ?? 'Package',
  version: () => displayVersion.value?.version ?? '',
  downloads: () => (downloads.value ? formatNumber(downloads.value.downloads) : ''),
  license: () => pkg.value?.license ?? '',
  primaryColor: '#60a5fa',
})

// We're using only @click because it catches touch events and enter hits
function handleClick(event: MouseEvent) {
  const target = (event?.target as HTMLElement | undefined)?.closest('a')
  if (!target) return

  const href = target.getAttribute('href')
  if (!href) return

  const match = href.match(/^(?:https?:\/\/)?(?:www\.)?npmjs\.(?:com|org)(\/.+)$/)
  if (!match || !match[1]) return

  const route = router.resolve(match[1])
  if (route) {
    event.preventDefault()
    router.push(route)
  }
}
</script>

<template>
  <main class="container flex-1 py-8 xl:py-12">
    <PackageSkeleton v-if="status === 'pending'" />

    <article v-else-if="status === 'success' && pkg" class="package-page">
      <!-- Package header -->
      <header class="area-header border-b border-border">
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
                <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
              </template>

              <NuxtLink
                v-if="resolvedVersion !== requestedVersion"
                :to="`/${pkg.name}/v/${displayVersion.version}`"
                :title="$t('package.view_permalink')"
                >{{ displayVersion.version }}</NuxtLink
              >
              <span v-else>v{{ displayVersion.version }}</span>

              <a
                v-if="hasProvenance(displayVersion)"
                :href="`https://www.npmjs.com/package/${pkg.name}/v/${displayVersion.version}#provenance`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center justify-center gap-1.5 text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
                :title="$t('package.verified_provenance')"
              >
                <span
                  class="i-solar:shield-check-outline w-3.5 h-3.5 shrink-0"
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
                >{{ $t('package.not_latest') }}</span
              >
            </span>

            <!-- Package metrics (module format, types) -->
            <ClientOnly>
              <PackageMetricsBadges
                v-if="displayVersion"
                :package-name="pkg.name"
                :version="displayVersion.version"
                class="self-baseline ms-1 sm:ms-2"
              />
              <template #fallback>
                <ul class="flex items-center gap-1.5 self-baseline ms-1 sm:ms-2">
                  <li class="skeleton w-8 h-5 rounded" />
                  <li class="skeleton w-12 h-5 rounded" />
                </ul>
              </template>
            </ClientOnly>

            <!-- Internal navigation: Docs + Code (hidden on mobile, shown in external links instead) -->
            <nav
              v-if="displayVersion"
              :aria-label="$t('package.navigation')"
              class="hidden sm:flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md shrink-0 ms-auto self-center"
            >
              <NuxtLink
                v-if="docsLink"
                :to="docsLink"
                class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-transparent text-fg-subtle hover:text-fg hover:bg-bg hover:shadow hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 inline-flex items-center gap-1.5"
                aria-keyshortcuts="d"
              >
                <span class="i-carbon:document w-3 h-3" aria-hidden="true" />
                {{ $t('package.links.docs') }}
                <kbd
                  class="inline-flex items-center justify-center w-4 h-4 text-xs bg-bg-muted border border-border rounded"
                  aria-hidden="true"
                >
                  d
                </kbd>
              </NuxtLink>
              <NuxtLink
                :to="{
                  name: 'code',
                  params: { path: [...pkg.name.split('/'), 'v', displayVersion.version] },
                }"
                class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-transparent text-fg-subtle hover:text-fg hover:bg-bg hover:shadow hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 inline-flex items-center gap-1.5"
                aria-keyshortcuts="."
              >
                <span class="i-carbon:code w-3 h-3" aria-hidden="true" />
                {{ $t('package.links.code') }}
                <kbd
                  class="inline-flex items-center justify-center w-4 h-4 text-xs bg-bg-muted border border-border rounded"
                  aria-hidden="true"
                >
                  .
                </kbd>
              </NuxtLink>
            </nav>
          </div>

          <!-- Description container with min-height to prevent CLS -->
          <div class="max-w-2xl min-h-[4.5rem]">
            <p v-if="pkg.description" class="text-fg-muted text-base m-0">
              <MarkdownText :text="pkg.description" :package-name="pkg.name" />
            </p>
            <p v-else class="text-fg-subtle text-base m-0 italic">
              {{ $t('package.no_description') }}
            </p>
          </div>

          <!-- External links -->
          <ul class="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-4 list-none m-0 p-0 mt-3">
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
                <span v-else>{{ $t('package.links.repo') }}</span>
              </a>
            </li>
            <li v-if="repositoryUrl && repoMeta && starsLink">
              <a
                :href="starsLink"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="w-4 h-4 i-carbon:star" aria-hidden="true" />
                {{ formatCompactNumber(stars, { decimals: 1 }) }}
              </a>
            </li>
            <li v-if="forks && forksLink">
              <a
                :href="forksLink"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:fork w-4 h-4" aria-hidden="true" />
                {{ formatCompactNumber(forks, { decimals: 1 }) }}
              </a>
            </li>
            <li v-if="homepageUrl">
              <a
                :href="homepageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:link w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.homepage') }}
              </a>
            </li>
            <li v-if="displayVersion?.bugs?.url">
              <a
                :href="displayVersion.bugs.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:warning w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.issues') }}
              </a>
            </li>
            <li>
              <a
                :href="`https://www.npmjs.com/package/${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
                :title="$t('common.view_on_npm')"
              >
                <span class="i-carbon:logo-npm w-4 h-4" aria-hidden="true" />
                npm
              </a>
            </li>
            <li v-if="jsrInfo?.exists && jsrInfo.url">
              <a
                :href="jsrInfo.url"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
                :title="$t('badges.jsr.title')"
              >
                <span class="i-simple-icons:jsr w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.jsr') }}
              </a>
            </li>
            <li v-if="fundingUrl">
              <a
                :href="fundingUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:favorite w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.fund') }}
              </a>
            </li>
            <!-- Mobile-only: Docs + Code links -->
            <li v-if="docsLink && displayVersion" class="sm:hidden">
              <NuxtLink
                :to="docsLink"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:document w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.docs') }}
              </NuxtLink>
            </li>
            <li v-if="displayVersion" class="sm:hidden">
              <NuxtLink
                :to="{
                  name: 'code',
                  params: { path: [...pkg.name.split('/'), 'v', displayVersion.version] },
                }"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:code w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.code') }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div
          v-if="deprecationNotice"
          class="border border-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-base text-red-400"
        >
          <h2 class="font-medium mb-2">
            {{
              deprecationNotice.type === 'package'
                ? $t('package.deprecation.package')
                : $t('package.deprecation.version')
            }}
          </h2>
          <p v-if="deprecationNotice.message" class="text-base m-0">
            <MarkdownText :text="deprecationNotice.message" />
          </p>
          <p v-else class="text-base m-0 italic">{{ $t('package.deprecation.no_reason') }}</p>
        </div>

        <!-- Stats grid -->
        <dl
          class="grid grid-cols-2 sm:grid-cols-11 gap-3 sm:gap-4 py-4 sm:py-6 mt-4 sm:mt-6 border-t border-border"
        >
          <div v-if="pkg.license" class="space-y-1 sm:col-span-2">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('package.stats.license') }}
            </dt>
            <dd class="font-mono text-sm text-fg">
              <LicenseDisplay :license="pkg.license" />
            </dd>
          </div>

          <div class="space-y-1 sm:col-span-2">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('package.stats.deps') }}
            </dt>
            <dd class="font-mono text-sm text-fg flex items-center justify-start gap-2">
              <!-- Direct deps (muted) -->
              <span class="text-fg-muted">{{ getDependencyCount(displayVersion) }}</span>

              <!-- Separator and total transitive deps -->
              <span class="text-fg-subtle mx-1">/</span>

              <ClientOnly>
                <span
                  v-if="
                    vulnTreeStatus === 'pending' || (installSizeStatus === 'pending' && !vulnTree)
                  "
                  class="inline-flex items-center gap-1 text-fg-subtle"
                >
                  <span
                    class="i-carbon:circle-dash w-3 h-3 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                </span>
                <span v-else-if="totalDepsCount !== null">{{ totalDepsCount }}</span>
                <span v-else class="text-fg-subtle">-</span>
                <template #fallback>
                  <span class="text-fg-subtle">-</span>
                </template>
              </ClientOnly>

              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://npmgraph.js.org/?q=${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1"
                :title="$t('package.stats.view_dependency_graph')"
              >
                <span class="i-carbon:network-3 w-3.5 h-3.5 inline-block" aria-hidden="true" />
                <span class="sr-only">{{ $t('package.stats.view_dependency_graph') }}</span>
              </a>

              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://node-modules.dev/grid/depth#install=${pkg.name}${displayVersion?.version ? `@${displayVersion.version}` : ''}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1"
                :title="$t('package.stats.inspect_dependency_tree')"
              >
                <span
                  class="i-solar:eye-scan-outline w-3.5 h-3.5 inline-block"
                  aria-hidden="true"
                />
                <span class="sr-only">{{ $t('package.stats.inspect_dependency_tree') }}</span>
              </a>
            </dd>
          </div>

          <div class="space-y-1 sm:col-span-3">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider flex items-center gap-1">
              {{ $t('package.stats.install_size') }}
              <span
                class="i-carbon:information w-3 h-3 text-fg-subtle"
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
                  class="i-carbon:circle-dash w-3 h-3 motion-safe:animate-spin"
                  aria-hidden="true"
                />
              </span>
              <span v-else-if="installSize?.totalSize">
                {{ formatBytes(installSize.totalSize) }}
              </span>
              <span v-else class="text-fg-subtle">-</span>
            </dd>
          </div>

          <!-- Vulnerabilities count -->
          <ClientOnly>
            <div class="space-y-1 sm:col-span-2">
              <dt class="text-xs text-fg-subtle uppercase tracking-wider">
                {{ $t('package.stats.vulns') }}
              </dt>
              <dd class="font-mono text-sm text-fg">
                <span
                  v-if="vulnTreeStatus === 'pending' || vulnTreeStatus === 'idle'"
                  class="inline-flex items-center gap-1 text-fg-subtle"
                >
                  <span
                    class="i-carbon:circle-dash w-3 h-3 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                </span>
                <span v-else-if="vulnTreeStatus === 'success'">
                  <span v-if="hasVulnerabilities" class="text-amber-500">{{ vulnCount }}</span>
                  <span v-else class="inline-flex items-center gap-1 text-fg-muted">
                    <span class="i-carbon:checkmark w-3 h-3" aria-hidden="true" />
                    0
                  </span>
                </span>
                <span v-else class="text-fg-subtle">-</span>
              </dd>
            </div>
            <template #fallback>
              <div class="space-y-1 sm:col-span-2">
                <dt class="text-xs text-fg-subtle uppercase tracking-wider">
                  {{ $t('package.stats.vulns') }}
                </dt>
                <dd class="font-mono text-sm text-fg-subtle">-</dd>
              </div>
            </template>
          </ClientOnly>

          <div v-if="pkg.time?.modified" class="space-y-1 sm:col-span-2">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('package.stats.updated') }}
            </dt>
            <dd class="font-mono text-sm text-fg">
              <DateTime :datetime="pkg.time.modified" date-style="medium" />
            </dd>
          </div>
        </dl>
      </header>

      <!-- Binary-only packages: Show only execute command (no install) -->
      <section v-if="isBinaryOnly" class="area-install scroll-mt-20">
        <div class="flex flex-wrap items-center justify-between mb-3">
          <h2 id="run-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.run.title') }}
          </h2>
          <!-- Package manager dropdown -->
          <PackageManagerSelect />
        </div>
        <div
          role="tabpanel"
          :id="`pm-panel-${activePmId}`"
          :aria-labelledby="`pm-tab-${activePmId}`"
        >
          <ExecuteCommandTerminal
            :package-name="pkg.name"
            :jsr-info="jsrInfo"
            :is-create-package="isCreatePkg"
          />
        </div>
      </section>

      <!-- Regular packages: Install command with optional run command -->
      <section v-else id="get-started" class="area-install scroll-mt-20">
        <div class="flex flex-wrap items-center justify-between mb-3">
          <h2
            id="get-started-heading"
            class="group text-xs text-fg-subtle uppercase tracking-wider"
          >
            <a
              href="#get-started"
              class="inline-flex items-center gap-1.5 py-1 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
            >
              {{ $t('package.get_started.title') }}
              <span
                class="i-carbon:link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                aria-hidden="true"
              />
            </a>
          </h2>
          <!-- Package manager dropdown -->
          <PackageManagerSelect />
        </div>
        <div
          role="tabpanel"
          :id="`pm-panel-${activePmId}`"
          :aria-labelledby="`pm-tab-${activePmId}`"
        >
          <InstallCommandTerminal
            :package-name="pkg.name"
            :requested-version="requestedVersion"
            :jsr-info="jsrInfo"
            :types-package-name="typesPackageName"
            :executable-info="executableInfo"
            :create-package-info="createPackageInfo"
          />
        </div>
      </section>

      <div class="area-vulns space-y-6">
        <!-- Bad package warning -->
        <PackageReplacement v-if="moduleReplacement" :replacement="moduleReplacement" />
        <!-- Vulnerability scan -->
        <ClientOnly>
          <PackageVulnerabilityTree
            v-if="displayVersion"
            :package-name="pkg.name"
            :version="displayVersion.version"
          />
          <PackageDeprecatedTree
            v-if="displayVersion"
            :package-name="pkg.name"
            :version="displayVersion.version"
            class="mt-3"
          />
        </ClientOnly>
      </div>

      <!-- README -->
      <section id="readme" class="area-readme min-w-0 scroll-mt-20">
        <h2 id="readme-heading" class="group text-xs text-fg-subtle uppercase tracking-wider mb-4">
          <a
            href="#readme"
            class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
          >
            {{ $t('package.readme.title') }}
            <span
              class="i-carbon:link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
            />
          </a>
        </h2>
        <!-- eslint-disable vue/no-v-html -- HTML is sanitized server-side -->
        <div
          v-if="readmeData?.html"
          class="readme-content prose prose-invert max-w-[70ch]"
          v-html="readmeData.html"
          @click="handleClick"
        />
        <p v-else class="text-fg-subtle italic">
          {{ $t('package.readme.no_readme') }}
          <a v-if="repositoryUrl" :href="repositoryUrl" rel="noopener noreferrer" class="link">{{
            $t('package.readme.view_on_github')
          }}</a>
        </p>
      </section>

      <div class="area-sidebar">
        <!-- Sidebar -->
        <aside class="sticky top-20 space-y-6 sm:space-y-8 min-w-0 overflow-hidden">
          <!-- Maintainers (with admin actions when connected) -->
          <PackageMaintainers :package-name="pkg.name" :maintainers="pkg.maintainers" />

          <!-- Team access controls (for scoped packages when connected) -->
          <ClientOnly>
            <PackageAccessControls :package-name="pkg.name" />
          </ClientOnly>

          <!-- Keywords -->
          <section id="keywords" v-if="displayVersion?.keywords?.length" class="scroll-mt-20">
            <h2
              id="keywords-heading"
              class="group text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              <a
                href="#keywords"
                class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
              >
                {{ $t('package.keywords_title') }}
                <span
                  class="i-carbon:link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-hidden="true"
                />
              </a>
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
          <PackageWeeklyDownloadStats :packageName />

          <!-- Playground links -->
          <PackagePlaygrounds
            v-if="readmeData?.playgroundLinks?.length"
            :links="readmeData.playgroundLinks"
          />

          <section
            id="compatibility"
            v-if="
              displayVersion?.engines && (displayVersion.engines.node || displayVersion.engines.npm)
            "
            class="scroll-mt-20"
          >
            <h2
              id="compatibility-heading"
              class="group text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              <a
                href="#compatibility"
                class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
              >
                {{ $t('package.compatibility') }}
                <span
                  class="i-carbon:link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-hidden="true"
                />
              </a>
            </h2>
            <dl class="space-y-2">
              <div v-if="displayVersion.engines.node" class="flex justify-between gap-4 py-1">
                <dt class="text-fg-muted text-sm shrink-0">node</dt>
                <dd class="font-mono text-sm text-fg text-end" :title="displayVersion.engines.node">
                  {{ displayVersion.engines.node }}
                </dd>
              </div>
              <div v-if="displayVersion.engines.npm" class="flex justify-between gap-4 py-1">
                <dt class="text-fg-muted text-sm shrink-0">npm</dt>
                <dd class="font-mono text-sm text-fg text-end" :title="displayVersion.engines.npm">
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
            v-if="hasDependencies && displayVersion"
            :package-name="pkg.name"
            :version="displayVersion.version"
            :dependencies="displayVersion.dependencies"
            :peer-dependencies="displayVersion.peerDependencies"
            :peer-dependencies-meta="displayVersion.peerDependenciesMeta"
            :optional-dependencies="displayVersion.optionalDependencies"
          />
        </aside>
      </div>
    </article>

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="flex flex-col items-center py-20 text-center"
    >
      <h1 class="font-mono text-2xl font-medium mb-4">{{ $t('package.not_found') }}</h1>
      <p class="text-fg-muted mb-8">
        {{ error?.message ?? $t('package.not_found_message') }}
      </p>
      <NuxtLink to="/" class="btn">{{ $t('common.go_back_home') }}</NuxtLink>
    </div>
  </main>
</template>

<style scoped>
.package-page {
  display: grid;
  gap: 2rem;

  /* Mobile: single column, sidebar above readme */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'header'
    'install'
    'vulns'
    'sidebar'
    'readme';
}

/* Tablet/medium: header/install/vulns full width, readme+sidebar side by side */
@media (min-width: 1024px) {
  .package-page {
    grid-template-columns: 2fr 1fr;
    grid-template-areas:
      'header  header'
      'install install'
      'vulns   vulns'
      'readme  sidebar';
  }
}

/* Desktop: floating sidebar alongside all content */
@media (min-width: 1280px) {
  .package-page {
    grid-template-columns: 1fr 20rem;
    grid-template-areas:
      'header  sidebar'
      'install sidebar'
      'vulns   sidebar'
      'readme  sidebar';
  }
}

.area-header {
  grid-area: header;
  overflow-x: hidden;
}

.area-install {
  grid-area: install;
}

.area-vulns {
  grid-area: vulns;
  overflow-x: hidden;
}

.area-readme {
  grid-area: readme;
  overflow-x: hidden;
}

.area-sidebar {
  grid-area: sidebar;
}

/* Improve package name wrapping for narrow screens */
.area-header h1 {
  overflow-wrap: anywhere;
}

/* Ensure description text wraps properly */
.area-header p {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
}

/* Allow install command text to break on narrow screens */
.area-install code {
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* Ensure all text content wraps on narrow screens */
.package-page {
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 100%;
}

/* Ensure all children respect max-width */
.package-page > * {
  max-width: 100%;
  min-width: 0;
}
</style>
