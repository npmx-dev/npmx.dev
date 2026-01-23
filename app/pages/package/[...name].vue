<script setup lang="ts">
import type { PackumentVersion, NpmVersionDist } from '#shared/types'

const route = useRoute('package-name')

// Parse package name and optional version from URL
// Patterns:
//   /package/nuxt → packageName: "nuxt", requestedVersion: null
//   /package/nuxt/v/4.2.0 → packageName: "nuxt", requestedVersion: "4.2.0"
//   /package/@nuxt/kit → packageName: "@nuxt/kit", requestedVersion: null
//   /package/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", requestedVersion: "1.0.0"
const parsedRoute = computed(() => {
  const segments = Array.isArray(route.params.name)
    ? route.params.name
    : [route.params.name ?? '']

  // Find the /v/ separator for version
  const vIndex = segments.indexOf('v')
  if (vIndex !== -1 && vIndex < segments.length - 1) {
    return {
      packageName: segments.slice(0, vIndex).join('/'),
      requestedVersion: segments.slice(vIndex + 1).join('/'),
    }
  }

  return {
    packageName: segments.join('/'),
    requestedVersion: null as string | null,
  }
})

const packageName = computed(() => parsedRoute.value.packageName)
const requestedVersion = computed(() => parsedRoute.value.requestedVersion)

// Extract org name from scoped package (e.g., "@nuxt/kit" -> "nuxt")
const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

const { data: pkg, status, error } = usePackage(packageName)

const { data: downloads } = usePackageDownloads(packageName, 'last-week')

// Fetch README for specific version if requested, otherwise latest
const { data: readmeData } = useLazyFetch(() => {
  const base = `/api/registry/readme/${packageName.value}`
  const version = requestedVersion.value
  return version ? `${base}/v/${version}` : base
}, { default: () => ({ html: '' }) })

// Get the version to display (requested or latest)
const displayVersion = computed(() => {
  if (!pkg.value) return null

  const reqVer = requestedVersion.value
  if (reqVer && pkg.value.versions[reqVer]) {
    return pkg.value.versions[reqVer]
  }

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

const hasDependencies = computed(() => {
  if (!displayVersion.value) return false
  const deps = displayVersion.value.dependencies
  const peerDeps = displayVersion.value.peerDependencies
  return (deps && Object.keys(deps).length > 0) || (peerDeps && Object.keys(peerDeps).length > 0)
})

const repositoryUrl = computed(() => {
  const repo = displayVersion.value?.repository
  if (!repo?.url) return null
  return normalizeGitUrl(repo.url)
})

const homepageUrl = computed(() => {
  return displayVersion.value?.homepage ?? null
})

function normalizeGitUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^ssh:\/\/git@github\.com/, 'https://github.com')
    .replace(/^git@github\.com:/, 'https://github.com/')
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

// Package manager install commands
const packageManagers = [
  { id: 'npm', label: 'npm', action: 'install' },
  { id: 'pnpm', label: 'pnpm', action: 'add' },
  { id: 'yarn', label: 'yarn', action: 'add' },
  { id: 'bun', label: 'bun', action: 'add' },
  { id: 'deno', label: 'deno', action: 'add npm:' },
] as const

type PackageManagerId = typeof packageManagers[number]['id']

// Persist preference in localStorage
const selectedPM = ref<PackageManagerId>('npm')

onMounted(() => {
  const stored = localStorage.getItem('npmx-pm')
  if (stored && packageManagers.some(pm => pm.id === stored)) {
    selectedPM.value = stored as PackageManagerId
  }
})

watch(selectedPM, (value) => {
  localStorage.setItem('npmx-pm', value)
})

const currentPM = computed(() => packageManagers.find(p => p.id === selectedPM.value) || packageManagers[0])
const selectedPMLabel = computed(() => currentPM.value.label)
const selectedPMAction = computed(() => currentPM.value.action)

const installCommand = computed(() => {
  if (!pkg.value) return ''
  const pm = currentPM.value
  // deno uses "add npm:package" format
  if (pm.id === 'deno') {
    return `${pm.label} ${pm.action}${pkg.value.name}`
  }
  return `${pm.label} ${pm.action} ${pkg.value.name}`
})

// Copy install command
const copied = ref(false)
async function copyInstallCommand() {
  if (!installCommand.value) return
  await navigator.clipboard.writeText(installCommand.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
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

watch(() => pkg.value?.description, () => {
  descriptionExpanded.value = false
  nextTick(checkDescriptionOverflow)
})

onMounted(() => {
  nextTick(checkDescriptionOverflow)
})

useSeoMeta({
  title: () => pkg.value?.name ? `${pkg.value.name} - npmx` : 'Package - npmx',
  description: () => pkg.value?.description ?? '',
})

defineOgImageComponent('Package', {
  name: () => pkg.value?.name ?? 'Package',
  version: () => displayVersion.value?.version ?? '',
  downloads: () => downloads.value ? formatNumber(downloads.value.downloads) : '',
  license: () => pkg.value?.license ?? '',
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <PackageSkeleton v-if="status === 'pending'" />

    <article
      v-else-if="status === 'success' && pkg"
      class="animate-fade-in"
    >
      <!-- Package header -->
      <header class="mb-8 pb-8 border-b border-border">
        <div class="mb-4">
          <!-- Package name and version -->
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            <h1 class="font-mono text-2xl sm:text-3xl font-medium">
              <NuxtLink
                v-if="orgName"
                :to="`/org/${orgName}`"
                class="text-fg-muted hover:text-fg transition-colors duration-200"
              >@{{ orgName }}</NuxtLink><span v-if="orgName">/</span>{{ orgName ? pkg.name.replace(`@${orgName}/`, '') : pkg.name }}
            </h1>
            <a
              v-if="displayVersion"
              :href="hasProvenance(displayVersion) ? `https://www.npmjs.com/package/${pkg.name}/v/${displayVersion.version}#provenance` : undefined"
              :target="hasProvenance(displayVersion) ? '_blank' : undefined"
              :rel="hasProvenance(displayVersion) ? 'noopener noreferrer' : undefined"
              class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 font-mono text-sm bg-bg-muted border border-border rounded-md transition-colors duration-200"
              :class="hasProvenance(displayVersion) ? 'hover:border-border-hover cursor-pointer' : 'cursor-default'"
              :title="hasProvenance(displayVersion) ? 'Verified provenance' : undefined"
            >
              v{{ displayVersion.version }}
              <span
                v-if="requestedVersion && latestVersion && displayVersion.version !== latestVersion.version"
                class="text-fg-subtle"
              >(not latest)</span>
              <span
                v-if="hasProvenance(displayVersion)"
                class="i-solar-shield-check-outline w-4 h-4 text-fg-muted"
                aria-label="Verified provenance"
              />
            </a>
          </div>
          <!-- Fixed height description container to prevent CLS -->
          <div
            ref="descriptionRef"
            class="relative max-w-2xl min-h-[4.5rem]"
          >
            <p
              v-if="pkg.description"
              class="text-fg-muted text-base m-0 overflow-hidden"
              :class="descriptionExpanded ? '' : 'max-h-[4.5rem]'"
            >
              <MarkdownText :text="pkg.description" />
            </p>
            <p
              v-else
              class="text-fg-subtle text-base m-0 italic"
            >
              No description provided
            </p>
            <!-- Fade overlay with show more button - only when collapsed and overflowing -->
            <div
              v-if="pkg.description && descriptionOverflows && !descriptionExpanded"
              class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-bg via-bg/90 to-transparent flex items-end justify-end"
            >
              <button
                type="button"
                class="font-mono text-xs text-fg-muted hover:text-fg bg-bg px-1 transition-colors duration-200"
                @click="descriptionExpanded = true"
              >
                show more
              </button>
            </div>
          </div>
        </div>

        <!-- Stats grid -->
        <dl class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-6">
          <div
            v-if="pkg.license"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              License
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ pkg.license }}
            </dd>
          </div>

          <div
            v-if="downloads"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Weekly
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ formatNumber(downloads.downloads) }}
            </dd>
          </div>

          <div
            v-if="displayVersion?.dist?.unpackedSize"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Size
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ formatBytes(displayVersion.dist.unpackedSize) }}
            </dd>
          </div>

          <div
            v-if="getDependencyCount(displayVersion) > 0"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Deps
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ getDependencyCount(displayVersion) }}
            </dd>
          </div>

          <div
            v-if="pkg.time?.modified"
            class="space-y-1 col-span-2"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Updated
            </dt>
            <dd class="font-mono text-sm text-fg">
              <time :datetime="pkg.time.modified">{{ formatDate(pkg.time.modified) }}</time>
            </dd>
          </div>
        </dl>

        <!-- Links -->
        <nav
          aria-label="Package links"
          class="mt-6"
        >
          <ul class="flex flex-wrap items-center gap-4 list-none m-0 p-0">
            <li v-if="repositoryUrl">
              <a
                :href="repositoryUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-logo-github w-4 h-4" />
                repo
              </a>
            </li>
            <li v-if="homepageUrl">
              <a
                :href="homepageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-link w-4 h-4" />
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
                <span class="i-carbon-warning w-4 h-4" />
                issues
              </a>
            </li>
            <li>
              <a
                :href="`https://www.npmjs.com/package/${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-cube w-4 h-4" />
                npm
              </a>
            </li>
            <li>
              <a
                :href="`https://socket.dev/npm/package/${pkg.name}/overview/${displayVersion?.version ?? 'latest'}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-security w-4 h-4" />
                security
              </a>
            </li>
            <li>
              <a
                :href="`https://npm.chart.dev/${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-chart-line w-4 h-4" />
                trends
              </a>
            </li>
            <li>
              <a
                :href="`https://pkg-size.dev/${pkg.name}`"
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-data-volume w-4 h-4" />
                size
              </a>
            </li>
            <li v-if="displayVersion">
              <NuxtLink
                :to="`/package/code/${pkg.name}/v/${displayVersion.version}`"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-code w-4 h-4" />
                code
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </header>

      <!-- Install command with package manager selector -->
      <section
        aria-labelledby="install-heading"
        class="mb-8"
      >
        <div class="flex items-center justify-between mb-3">
          <h2
            id="install-heading"
            class="text-xs text-fg-subtle uppercase tracking-wider"
          >
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
                :class="selectedPM === pm.id
                  ? 'bg-bg-elevated text-fg'
                  : 'text-fg-subtle hover:text-fg-muted'"
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
            <div class="flex gap-1.5 px-4 pt-3">
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
              <span class="w-2.5 h-2.5 rounded-full bg-[#333]" />
            </div>
            <div class="flex items-center gap-2 px-4 pt-3 pb-4">
              <span class="text-fg-subtle font-mono text-sm select-none">$</span>
              <code class="font-mono text-sm"><ClientOnly><span class="text-fg">{{ selectedPMLabel }}</span> <span class="text-fg-muted">{{ selectedPMAction }}</span>&nbsp;<span
                v-if="selectedPM !== 'deno'"
                class="text-fg-muted"
              > {{ pkg.name }}</span><span
                v-else
                class="text-fg-muted"
              >{{ pkg.name }}</span><template #fallback><span class="text-fg">npm</span>&nbsp;<span class="text-fg-muted">install {{ pkg.name }}</span></template></ClientOnly></code>
            </div>
          </div>
          <button
            class="absolute top-3 right-3 px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-all duration-200 hover:(text-fg border-border-hover) active:scale-95"
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
            <h2
              id="readme-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-4"
            >
              Readme
            </h2>
            <!-- eslint-disable vue/no-v-html -- HTML is sanitized server-side -->
            <div
              v-if="readmeData?.html"
              class="readme-content prose prose-invert max-w-none"
              v-html="readmeData.html"
            />
            <p
              v-else
              class="text-fg-subtle italic"
            >
              No README available.
              <a
                v-if="repositoryUrl"
                :href="repositoryUrl"
                rel="noopener noreferrer"
                class="link"
              >View on GitHub</a>
            </p>
          </section>
        </div>

        <!-- Sidebar -->
        <aside class="order-1 lg:order-2 space-y-8">
          <!-- Maintainers (with admin actions when connected) -->
          <PackageMaintainers
            :package-name="pkg.name"
            :maintainers="pkg.maintainers"
          />

          <!-- Team access controls (for scoped packages when connected) -->
          <ClientOnly>
            <PackageAccessControls :package-name="pkg.name" />
          </ClientOnly>

          <!-- Keywords -->
          <section
            v-if="displayVersion?.keywords?.length"
            aria-labelledby="keywords-heading"
          >
            <h2
              id="keywords-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Keywords
            </h2>
            <ul class="flex flex-wrap gap-1.5 list-none m-0 p-0">
              <li
                v-for="keyword in displayVersion.keywords.slice(0, 15)"
                :key="keyword"
              >
                <NuxtLink
                  :to="`/search?q=keywords:${encodeURIComponent(keyword)}`"
                  class="tag"
                >
                  {{ keyword }}
                </NuxtLink>
              </li>
            </ul>
          </section>

          <section
            v-if="displayVersion?.engines && (displayVersion.engines.node || displayVersion.engines.npm)"
            aria-labelledby="compatibility-heading"
          >
            <h2
              id="compatibility-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Compatibility
            </h2>
            <dl class="space-y-2">
              <div
                v-if="displayVersion.engines.node"
                class="flex items-center justify-between py-1"
              >
                <dt class="text-fg-muted text-sm">
                  node
                </dt>
                <dd class="font-mono text-sm text-fg">
                  {{ displayVersion.engines.node }}
                </dd>
              </div>
              <div
                v-if="displayVersion.engines.npm"
                class="flex items-center justify-between py-1"
              >
                <dt class="text-fg-muted text-sm">
                  npm
                </dt>
                <dd class="font-mono text-sm text-fg">
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

          <!-- Dependencies -->
          <PackageDependencies
            v-if="hasDependencies"
            :package-name="pkg.name"
            :dependencies="displayVersion?.dependencies"
            :peer-dependencies="displayVersion?.peerDependencies"
            :peer-dependencies-meta="displayVersion?.peerDependenciesMeta"
          />
        </aside>
      </div>
    </article>

    <!-- Error state -->
    <div
      v-else-if="status === 'error'"
      role="alert"
      class="py-20 text-center"
    >
      <h1 class="font-mono text-2xl font-medium mb-4">
        Package Not Found
      </h1>
      <p class="text-fg-muted mb-8">
        {{ error?.message ?? 'The package could not be found.' }}
      </p>
      <NuxtLink
        to="/"
        class="btn"
      >
        Go back home
      </NuxtLink>
    </div>
  </main>
</template>
