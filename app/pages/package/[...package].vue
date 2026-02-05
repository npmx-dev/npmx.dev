<script setup lang="ts">
import type {
  NpmVersionDist,
  PackumentVersion,
  ProvenanceDetails,
  ReadmeResponse,
  SkillsListResponse,
} from '#shared/types'
import type { JsrPackageInfo } from '#shared/types/jsr'
import { assertValidPackageName } from '#shared/utils/npm'
import { joinURL } from 'ufo'
import { areUrlsEquivalent } from '#shared/utils/url'
import { isEditableElement } from '~/utils/input'
import { formatBytes } from '~/utils/formatters'
import { getDependencyCount } from '~/utils/npm/dependency-count'
import { NuxtLink } from '#components'
import { useModal } from '~/composables/useModal'
import { useAtproto } from '~/composables/atproto/useAtproto'
import { togglePackageLike } from '~/utils/atproto/likes'

definePageMeta({
  name: 'package',
  alias: ['/:package(.*)*'],
})

defineOgImageComponent('Package', {
  name: () => packageName.value,
  version: () => requestedVersion.value ?? '',
  primaryColor: '#60a5fa',
})

const router = useRouter()

const header = useTemplateRef('header')
const isHeaderPinned = shallowRef(false)

function checkHeaderPosition() {
  const el = header.value
  if (!el) return

  const style = getComputedStyle(el)
  const top = parseFloat(style.top) || 0
  const rect = el.getBoundingClientRect()

  isHeaderPinned.value = Math.abs(rect.top - top) < 1
}

useEventListener('scroll', checkHeaderPosition, { passive: true })
useEventListener('resize', checkHeaderPosition)

onMounted(() => {
  checkHeaderPosition()
})

const { packageName, requestedVersion, orgName } = usePackageRoute()
const selectedPM = useSelectedPackageManager()
const activePmId = computed(() => selectedPM.value ?? 'npm')

if (import.meta.server) {
  assertValidPackageName(packageName.value)
}

// Fetch README for specific version if requested, otherwise latest
const { data: readmeData } = useLazyFetch<ReadmeResponse>(
  () => {
    const base = `/api/registry/readme/${packageName.value}`
    const version = requestedVersion.value
    return version ? `${base}/v/${version}` : base
  },
  { default: () => ({ html: '', playgroundLinks: [], toc: [] }) },
)

// Track active TOC item based on scroll position
const tocItems = computed(() => readmeData.value?.toc ?? [])
const { activeId: activeTocId, scrollToHeading } = useActiveTocItem(tocItems)

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

const { data: skillsData } = useLazyFetch<SkillsListResponse>(
  () => {
    const base = `/skills/${packageName.value}`
    const version = requestedVersion.value
    return version ? `${base}/v/${version}` : base
  },
  { default: () => ({ package: '', version: '', skills: [] }) },
)

const { data: packageAnalysis } = usePackageAnalysis(packageName, requestedVersion)
const { data: moduleReplacement } = useModuleReplacement(packageName)

const {
  data: resolvedVersion,
  status: versionStatus,
  error: versionError,
} = await useResolvedVersion(packageName, requestedVersion)

if (
  versionStatus.value === 'error' &&
  versionError.value?.statusCode &&
  versionError.value.statusCode >= 400 &&
  versionError.value.statusCode < 500
) {
  throw createError({
    statusCode: 404,
    statusMessage: $t('package.not_found'),
    message: $t('package.not_found_message'),
  })
}

const {
  data: pkg,
  status,
  error,
} = usePackage(packageName, resolvedVersion.value ?? requestedVersion.value)
const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)

// Process package description
const pkgDescription = useMarkdown(() => ({
  text: pkg.value?.description ?? '',
  packageName: pkg.value?.name,
}))

//copy package name
const { copied: copiedPkgName, copy: copyPkgName } = useClipboard({
  source: packageName,
  copiedDuring: 2000,
})

// Fetch dependency analysis (lazy, client-side)
// This is the same composable used by PackageVulnerabilityTree and PackageDeprecatedTree
const { data: vulnTree, status: vulnTreeStatus } = useDependencyAnalysis(
  packageName,
  () => resolvedVersion.value ?? '',
)

const {
  data: provenanceData,
  status: provenanceStatus,
  execute: fetchProvenance,
} = useLazyFetch<ProvenanceDetails | null>(
  () => {
    const v = displayVersion.value
    if (!v || !hasProvenance(v)) return ''
    return `/api/registry/provenance/${packageName.value}/v/${v.version}`
  },
  {
    default: () => null,
    server: false,
    immediate: false,
  },
)
if (import.meta.client) {
  watch(
    displayVersion,
    v => {
      if (v && hasProvenance(v) && provenanceStatus.value === 'idle') {
        fetchProvenance()
      }
    },
    { immediate: true },
  )
}

const provenanceBadgeMounted = shallowRef(false)
onMounted(() => {
  provenanceBadgeMounted.value = true
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
    return {
      type: 'package' as const,
      message: displayVersion.value.deprecated,
    }
  }

  // Otherwise show "version deprecated"
  return { type: 'version' as const, message: displayVersion.value.deprecated }
})

const deprecationNoticeMessage = useMarkdown(() => ({
  text: deprecationNotice.value?.message ?? '',
}))

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
  if (!resolvedVersion.value) return null

  return `/package-docs/${pkg.value!.name}/v/${resolvedVersion.value}`
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
  const base = `https://npmx.dev/package/${packageName.value}`
  return requestedVersion.value ? `${base}/v/${requestedVersion.value}` : base
})

//atproto
// TODO: Maybe set this where it's not loaded here every load?
const { user } = useAtproto()

const authModal = useModal('auth-modal')

const { data: likesData } = useFetch(() => `/api/social/likes/${packageName.value}`, {
  default: () => ({ totalLikes: 0, userHasLiked: false }),
  server: false,
})

const isLikeActionPending = ref(false)

const likeAction = async () => {
  if (user.value?.handle == null) {
    authModal.open()
    return
  }

  if (isLikeActionPending.value) return

  const currentlyLiked = likesData.value?.userHasLiked ?? false
  const currentLikes = likesData.value?.totalLikes ?? 0

  // Optimistic update
  likesData.value = {
    totalLikes: currentlyLiked ? currentLikes - 1 : currentLikes + 1,
    userHasLiked: !currentlyLiked,
  }

  isLikeActionPending.value = true

  try {
    const result = await togglePackageLike(packageName.value, currentlyLiked, user.value?.handle)

    isLikeActionPending.value = false

    if (result.success) {
      // Update with server response
      likesData.value = result.data
    } else {
      // Revert on error
      likesData.value = {
        totalLikes: currentLikes,
        userHasLiked: currentlyLiked,
      }
    }
  } catch {
    // Revert on error
    likesData.value = {
      totalLikes: currentLikes,
      userHasLiked: currentlyLiked,
    }
    isLikeActionPending.value = false
  }
}

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: () => (pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx'),
  ogTitle: () => (pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx'),
  twitterTitle: () => (pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx'),
  description: () => pkg.value?.description ?? '',
  ogDescription: () => pkg.value?.description ?? '',
  twitterDescription: () => pkg.value?.description ?? '',
})

onKeyStroke(
  e => isKeyWithoutModifiers(e, '.') && !isEditableElement(e.target),
  e => {
    if (pkg.value == null || resolvedVersion.value == null) return
    e.preventDefault()
    navigateTo({
      name: 'code',
      params: {
        path: [pkg.value.name, 'v', resolvedVersion.value],
      },
    })
  },
  { dedupe: true },
)

onKeyStroke(
  e => isKeyWithoutModifiers(e, 'd') && !isEditableElement(e.target),
  e => {
    if (!docsLink.value) return
    e.preventDefault()
    navigateTo(docsLink.value)
  },
  { dedupe: true },
)

onKeyStroke(
  e => isKeyWithoutModifiers(e, 'c') && !isEditableElement(e.target),
  e => {
    if (!pkg.value) return
    e.preventDefault()
    router.push({ path: '/compare', query: { packages: pkg.value.name } })
  },
)
</script>

<template>
  <main class="container flex-1 w-full py-8">
    <PackageSkeleton v-if="status === 'pending'" />

    <article v-else-if="status === 'success' && pkg" class="package-page">
      <!-- Package header -->
      <header
        class="area-header sticky top-14 z-1 bg-[--bg] py-2 border-border"
        ref="header"
        :class="{ 'border-b': isHeaderPinned }"
      >
        <!-- Package name and version -->
        <div class="flex items-baseline gap-2 sm:gap-3 flex-wrap min-w-0">
          <div class="group relative flex flex-col items-start min-w-0">
            <h1
              class="font-mono text-2xl sm:text-3xl font-medium min-w-0 break-words"
              :title="pkg.name"
            >
              <NuxtLink
                v-if="orgName"
                :to="{ name: 'org', params: { org: orgName } }"
                class="text-fg-muted hover:text-fg transition-colors duration-200"
              >
                @{{ orgName }}
              </NuxtLink>
              <span v-if="orgName">/</span>
              <span :class="{ 'text-fg-muted': orgName }">
                {{ orgName ? pkg.name.replace(`@${orgName}/`, '') : pkg.name }}
              </span>
            </h1>

            <!-- Floating copy button -->
            <button
              type="button"
              @click="copyPkgName()"
              class="copy-button absolute z-20 inset-is-0 top-full inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-mono whitespace-nowrap transition-all duration-150 opacity-0 -translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:pointer-events-auto"
              :class="
                copiedPkgName ? 'text-accent bg-accent/10' : 'text-fg-muted bg-bg border-border'
              "
              :aria-label="copiedPkgName ? $t('common.copied') : $t('package.copy_name')"
            >
              <span
                :class="copiedPkgName ? 'i-carbon:checkmark' : 'i-carbon:copy'"
                class="w-3.5 h-3.5"
                aria-hidden="true"
              />
              {{ copiedPkgName ? $t('common.copied') : $t('package.copy_name') }}
            </button>
          </div>
          <span
            v-if="resolvedVersion"
            class="inline-flex items-baseline gap-1.5 font-mono text-base sm:text-lg text-fg-muted shrink-0"
          >
            <!-- Version resolution indicator (e.g., "latest → 4.2.0") -->
            <template v-if="requestedVersion && resolvedVersion !== requestedVersion">
              <span class="font-mono text-fg-muted text-sm">{{ requestedVersion }}</span>
              <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
            </template>

            <NuxtLink
              v-if="requestedVersion && resolvedVersion !== requestedVersion"
              :to="`/package/${pkg.name}/v/${resolvedVersion}`"
              :title="$t('package.view_permalink')"
              >{{ resolvedVersion }}</NuxtLink
            >
            <span v-else>v{{ resolvedVersion }}</span>

            <template v-if="hasProvenance(displayVersion) && provenanceBadgeMounted">
              <TooltipApp
                :text="
                  provenanceData && provenanceStatus !== 'pending'
                    ? $t('package.provenance_section.built_and_signed_on', {
                        provider: provenanceData.providerLabel,
                      })
                    : $t('package.verified_provenance')
                "
                position="bottom"
              >
                <a
                  href="#provenance"
                  :aria-label="$t('package.provenance_section.view_more_details')"
                  class="inline-flex items-center justify-center gap-1.5 text-fg-muted hover:text-emerald-500 transition-colors duration-200 min-w-6 min-h-6"
                >
                  <span class="i-lucide-shield-check w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </a>
              </TooltipApp>
            </template>
            <span
              v-if="requestedVersion && latestVersion && resolvedVersion !== latestVersion.version"
              class="text-fg-subtle text-sm shrink-0"
              >{{ $t('package.not_latest') }}</span
            >
          </span>

          <!-- Package metrics (module format, types) -->
          <div class="flex gap-2 sm:gap-3 flex-wrap">
            <ClientOnly>
              <PackageMetricsBadges
                v-if="resolvedVersion"
                :package-name="pkg.name"
                :version="resolvedVersion"
                :is-binary="isBinaryOnly"
                class="self-baseline ms-1 sm:ms-2"
              />

              <!-- Package likes -->
              <TooltipApp
                :text="
                  likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
                "
                position="bottom"
              >
                <button
                  @click="likeAction"
                  type="button"
                  :title="
                    likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
                  "
                  class="inline-flex items-center gap-1.5 font-mono text-sm text-fg hover:text-fg-muted transition-colors duration-200"
                  :aria-label="
                    likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
                  "
                >
                  <span
                    :class="
                      likesData?.userHasLiked
                        ? 'i-lucide-heart-minus text-red-500'
                        : 'i-lucide-heart-plus'
                    "
                    class="w-4 h-4"
                    aria-hidden="true"
                  />
                  <span>{{
                    formatCompactNumber(likesData?.totalLikes ?? 0, { decimals: 1 })
                  }}</span>
                </button>
              </TooltipApp>
              <template #fallback>
                <div
                  class="flex items-center gap-1.5 list-none m-0 p-0 relative top-[5px] self-baseline ms-1 sm:ms-2"
                >
                  <SkeletonBlock class="w-16 h-5.5 rounded" />
                  <SkeletonBlock class="w-13 h-5.5 rounded" />
                  <SkeletonBlock class="w-13 h-5.5 rounded" />
                  <SkeletonBlock class="w-13 h-5.5 rounded bg-bg-subtle" />
                </div>
              </template>
            </ClientOnly>
          </div>

          <!-- Internal navigation: Docs + Code + Compare (hidden on mobile, shown in external links instead) -->
          <nav
            v-if="resolvedVersion"
            :aria-label="$t('package.navigation')"
            class="hidden sm:flex items-center gap-0.5 p-0.5 bg-bg-subtle border border-border-subtle rounded-md shrink-0 ms-auto self-center"
          >
            <NuxtLink
              v-if="docsLink"
              :to="docsLink"
              class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-transparent text-fg-subtle hover:text-fg hover:bg-bg hover:shadow hover:border-border inline-flex items-center gap-1.5"
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
              :to="`/package-code/${pkg.name}/v/${resolvedVersion}`"
              class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-transparent text-fg-subtle hover:text-fg hover:bg-bg hover:shadow hover:border-border inline-flex items-center gap-1.5"
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
            <NuxtLink
              :to="{ path: '/compare', query: { packages: pkg.name } }"
              class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-transparent text-fg-subtle hover:text-fg hover:bg-bg hover:shadow hover:border-border inline-flex items-center gap-1.5"
              aria-keyshortcuts="c"
            >
              <span class="i-carbon:compare w-3 h-3" aria-hidden="true" />
              {{ $t('package.links.compare') }}
              <kbd
                class="inline-flex items-center justify-center w-4 h-4 text-xs bg-bg-muted border border-border rounded"
                aria-hidden="true"
              >
                c
              </kbd>
            </NuxtLink>
          </nav>
        </div>
      </header>

      <!-- Package details -->
      <section class="area-details">
        <div class="mb-4">
          <!-- Description container with min-height to prevent CLS -->
          <div class="max-w-2xl min-h-[4.5rem]">
            <p v-if="pkgDescription" class="text-fg-muted text-base m-0">
              <span v-html="pkgDescription" />
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
            <!-- Mobile-only: Docs + Code + Compare links -->
            <li v-if="docsLink && displayVersion" class="sm:hidden">
              <NuxtLink
                :to="docsLink"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:document w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.docs') }}
              </NuxtLink>
            </li>
            <li v-if="resolvedVersion" class="sm:hidden">
              <NuxtLink
                :to="`/package-code/${pkg.name}/v/${resolvedVersion}`"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:code w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.code') }}
              </NuxtLink>
            </li>
            <li class="sm:hidden">
              <NuxtLink
                :to="{ path: '/compare', query: { packages: pkg.name } }"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon:compare w-4 h-4" aria-hidden="true" />
                {{ $t('package.links.compare') }}
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
          <p v-if="deprecationNoticeMessage" class="text-base m-0">
            <span v-html="deprecationNoticeMessage" />
          </p>
          <p v-else class="text-base m-0 italic">
            {{ $t('package.deprecation.no_reason') }}
          </p>
        </div>

        <!-- Stats grid -->
        <dl
          class="grid grid-cols-2 sm:grid-cols-7 md:grid-cols-11 gap-3 sm:gap-4 py-4 sm:py-6 mt-4 sm:mt-6 border-t border-b border-border"
        >
          <div class="space-y-1 sm:col-span-2">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('package.stats.license') }}
            </dt>
            <dd class="font-mono text-sm text-fg">
              <LicenseDisplay v-if="pkg.license" :license="pkg.license" />
              <span v-else>{{ $t('package.license.none') }}</span>
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
              <template v-if="getDependencyCount(displayVersion) !== totalDepsCount">
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
              </template>

              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://npmgraph.js.org/?q=${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 focus-visible:outline-accent/70 rounded"
                :title="$t('package.stats.view_dependency_graph')"
              >
                <span class="i-carbon:network-3 w-3.5 h-3.5" aria-hidden="true" />
                <span class="sr-only">{{ $t('package.stats.view_dependency_graph') }}</span>
              </a>

              <a
                v-if="getDependencyCount(displayVersion) > 0"
                :href="`https://node-modules.dev/grid/depth#install=${pkg.name}${resolvedVersion ? `@${resolvedVersion}` : ''}`"
                target="_blank"
                rel="noopener noreferrer"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 focus-visible:outline-accent/70 rounded"
                :title="$t('package.stats.inspect_dependency_tree')"
              >
                <span class="i-lucide-view w-3.5 h-3.5" aria-hidden="true" />
                <span class="sr-only">{{ $t('package.stats.inspect_dependency_tree') }}</span>
              </a>
            </dd>
          </div>

          <div class="space-y-1 sm:col-span-3">
            <dt class="text-xs text-fg-subtle uppercase tracking-wider flex items-center gap-1">
              {{ $t('package.stats.install_size') }}
              <TooltipApp :text="sizeTooltip">
                <span
                  tabindex="0"
                  class="inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 text-fg-subtle cursor-help focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
                >
                  <span class="i-carbon:information w-3 h-3" aria-hidden="true" />
                </span>
              </TooltipApp>
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
              <template v-if="getDependencyCount(displayVersion) > 0">
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
              </template>
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

          <div
            v-if="resolvedVersion && pkg.time?.[resolvedVersion]"
            class="space-y-1 sm:col-span-2"
          >
            <dt
              class="text-xs text-fg-subtle uppercase tracking-wider"
              :title="
                $t('package.stats.published_tooltip', {
                  package: pkg.name,
                  version: resolvedVersion,
                })
              "
            >
              {{ $t('package.stats.published') }}
            </dt>
            <dd class="font-mono text-sm text-fg">
              <DateTime :datetime="pkg.time[resolvedVersion]!" date-style="medium" />
            </dd>
          </div>
        </dl>

        <!-- Skills Modal -->
        <ClientOnly>
          <PackageSkillsModal
            :skills="skillsData?.skills ?? []"
            :package-name="pkg.name"
            :version="resolvedVersion || undefined"
          />
        </ClientOnly>
      </section>

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
          <TerminalExecute
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
                class="i-carbon:link w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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
          <TerminalInstall
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
            v-if="resolvedVersion"
            :package-name="pkg.name"
            :version="resolvedVersion"
          />
          <PackageDeprecatedTree
            v-if="resolvedVersion"
            :package-name="pkg.name"
            :version="resolvedVersion"
            class="mt-3"
          />
        </ClientOnly>
      </div>

      <!-- README -->
      <section id="readme" class="area-readme min-w-0 scroll-mt-20">
        <div class="flex flex-wrap items-center justify-between mb-4 px-1">
          <h2 id="readme-heading" class="group text-xs text-fg-subtle uppercase tracking-wider">
            <a
              href="#readme"
              class="inline-flex py-4 px-2 items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline mt-1"
            >
              {{ $t('package.readme.title') }}
              <span
                class="i-carbon:link w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                aria-hidden="true"
              />
            </a>
          </h2>
          <ClientOnly>
            <ReadmeTocDropdown
              v-if="readmeData?.toc && readmeData.toc.length > 1"
              :toc="readmeData.toc"
              :active-id="activeTocId"
              :scroll-to-heading="scrollToHeading"
            />
          </ClientOnly>
        </div>

        <!-- eslint-disable vue/no-v-html -- HTML is sanitized server-side -->
        <Readme v-if="readmeData?.html" :html="readmeData.html" />
        <p v-else class="text-fg-subtle italic">
          {{ $t('package.readme.no_readme') }}
          <a
            v-if="repositoryUrl"
            :href="repositoryUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="link"
            >{{ $t('package.readme.view_on_github') }}</a
          >
        </p>

        <section
          v-if="hasProvenance(displayVersion) && provenanceBadgeMounted"
          id="provenance"
          class="scroll-mt-20"
        >
          <div
            v-if="provenanceStatus === 'pending'"
            class="mt-8 flex items-center gap-2 text-fg-subtle text-sm"
          >
            <span
              class="i-carbon-circle-dash w-4 h-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
            <span>{{ $t('package.provenance_section.title') }}…</span>
          </div>
          <PackageProvenanceSection
            v-else-if="provenanceData"
            :details="provenanceData"
            class="mt-8"
          />
          <!-- Error state: provenance exists but details failed to load -->
          <div
            v-else-if="provenanceStatus === 'error'"
            class="mt-8 flex items-center gap-2 text-fg-subtle text-sm"
          >
            <span class="i-carbon:warning w-4 h-4" aria-hidden="true" />
            <span>{{ $t('package.provenance_section.error_loading') }}</span>
          </div>
        </section>
      </section>
      <div class="area-sidebar">
        <!-- Sidebar -->
        <div
          class="sidebar-scroll sticky top-34 space-y-6 sm:space-y-8 min-w-0 overflow-y-auto pe-2.5 lg:(max-h-[calc(100dvh-8.5rem)] overscroll-contain) xl:(top-22 pt-2 max-h-[calc(100dvh-6rem)])"
        >
          <!-- Team access controls (for scoped packages when connected) -->
          <ClientOnly>
            <PackageAccessControls :package-name="pkg.name" />
          </ClientOnly>

          <!-- Agent Skills -->
          <ClientOnly>
            <PackageSkillsCard
              v-if="skillsData?.skills?.length"
              :skills="skillsData.skills"
              :package-name="pkg.name"
              :version="resolvedVersion || undefined"
            />
          </ClientOnly>

          <!-- Download stats -->
          <PackageWeeklyDownloadStats :packageName :createdIso="pkg?.time?.created ?? null" />

          <!-- Playground links -->
          <PackagePlaygrounds
            v-if="readmeData?.playgroundLinks?.length"
            :links="readmeData.playgroundLinks"
          />

          <PackageCompatibility :engines="displayVersion?.engines" />

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
            v-if="hasDependencies && resolvedVersion && displayVersion"
            :package-name="pkg.name"
            :version="resolvedVersion"
            :dependencies="displayVersion.dependencies"
            :peer-dependencies="displayVersion.peerDependencies"
            :peer-dependencies-meta="displayVersion.peerDependenciesMeta"
            :optional-dependencies="displayVersion.optionalDependencies"
          />

          <!-- Keywords -->
          <PackageKeywords :keywords="displayVersion?.keywords" />

          <!-- Maintainers (with admin actions when connected) -->
          <PackageMaintainers :package-name="pkg.name" :maintainers="pkg.maintainers" />
        </div>
      </div>
    </article>

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="flex flex-col items-center py-20 text-center"
    >
      <h1 class="font-mono text-2xl font-medium mb-4">
        {{ $t('package.not_found') }}
      </h1>
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
    'details'
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
      'details details'
      'install install'
      'vulns   vulns'
      'readme  sidebar';
    grid-template-rows: auto auto auto auto 1fr;
  }
}

/* Desktop: floating sidebar alongside all content */
@media (min-width: 1280px) {
  .package-page {
    grid-template-columns: 1fr 20rem;
    grid-template-areas:
      'header  sidebar'
      'details sidebar'
      'install sidebar'
      'vulns   sidebar'
      'readme  sidebar';
  }
}

.area-header {
  grid-area: header;
}

.area-details {
  grid-area: details;
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

/* Sidebar scrollbar: hidden by default, shown on hover/focus */
@media (min-width: 1024px) {
  .sidebar-scroll {
    scrollbar-gutter: stable;
    scrollbar-width: none;
  }

  .sidebar-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  .sidebar-scroll:hover,
  .sidebar-scroll:focus-within {
    scrollbar-width: auto;
  }

  .sidebar-scroll:hover::-webkit-scrollbar,
  .sidebar-scroll:focus-within::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .sidebar-scroll:hover::-webkit-scrollbar-thumb,
  .sidebar-scroll:focus-within::-webkit-scrollbar-thumb {
    background-color: var(--border);
    border-radius: 9999px;
  }

  .sidebar-scroll:hover::-webkit-scrollbar-track,
  .sidebar-scroll:focus-within::-webkit-scrollbar-track {
    background: transparent;
  }
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

.copy-button {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  width: 1px;
  transition:
    opacity 0.25s 0.1s,
    translate 0.15s 0.1s,
    clip 0.01s 0.34s allow-discrete,
    clip-path 0.01s 0.34s allow-discrete,
    height 0.01s 0.34s allow-discrete,
    width 0.01s 0.34s allow-discrete;
}

.group:hover .copy-button,
.copy-button:focus-visible {
  clip: auto;
  clip-path: none;
  height: auto;
  overflow: visible;
  width: auto;
  transition:
    opacity 0.15s,
    translate 0.15s;
}

@media (hover: none) {
  .copy-button {
    display: none;
  }
}
</style>
