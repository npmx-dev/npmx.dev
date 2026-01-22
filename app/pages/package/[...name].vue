<script setup lang="ts">
import type { PackumentVersion } from '#shared/types'

const route = useRoute('package-name')

const packageName = computed(() => {
  const segments = route.params.name
  if (Array.isArray(segments)) {
    return segments.join('/')
  }
  return segments ?? ''
})

const { data: pkg, status, error } = usePackage(packageName)

const { data: downloads } = usePackageDownloads(packageName, 'last-week')

const { data: readmeData } = useLazyFetch(() => `/api/registry/readme/${packageName.value}`, {
  key: `readme:${packageName.value}`,
  default: () => ({ html: '' }),
})

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const sortedVersions = computed(() => {
  if (!pkg.value?.versions) return []
  return Object.keys(pkg.value.versions)
    .sort((a, b) => {
      const timeA = pkg.value?.time[a]
      const timeB = pkg.value?.time[b]
      if (!timeA || !timeB) return 0
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, 20)
})

const repositoryUrl = computed(() => {
  const repo = latestVersion.value?.repository
  if (!repo?.url) return null
  return normalizeGitUrl(repo.url)
})

const homepageUrl = computed(() => {
  return latestVersion.value?.homepage ?? null
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
const descriptionRef = ref<HTMLParagraphElement>()
const descriptionOverflows = ref(false)

// Check if description overflows on mount/update
function checkDescriptionOverflow() {
  if (descriptionRef.value) {
    // Compare scrollHeight to the fixed container height (3 lines ~= 72px)
    descriptionOverflows.value = descriptionRef.value.scrollHeight > 72
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
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div class="flex-1 min-w-0">
            <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-2">
              {{ pkg.name }}
            </h1>
            <!-- Fixed height description container to prevent CLS -->
            <div class="relative max-w-2xl min-h-[4.5rem]">
              <p
                v-if="pkg.description"
                ref="descriptionRef"
                class="text-fg-muted text-base m-0 overflow-hidden"
                :class="descriptionExpanded ? '' : 'max-h-[4.5rem]'"
              >
                {{ pkg.description }}
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

          <!-- Version badge -->
          <span
            v-if="latestVersion"
            class="shrink-0 px-3 py-1 font-mono text-sm bg-bg-muted border border-border rounded-md"
          >
            v{{ latestVersion.version }}
          </span>
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
            v-if="latestVersion?.dist?.unpackedSize"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Size
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ formatBytes(latestVersion.dist.unpackedSize) }}
            </dd>
          </div>

          <div
            v-if="getDependencyCount(latestVersion) > 0"
            class="space-y-1"
          >
            <dt class="text-xs text-fg-subtle uppercase tracking-wider">
              Deps
            </dt>
            <dd class="font-mono text-sm text-fg">
              {{ getDependencyCount(latestVersion) }}
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
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-link w-4 h-4" />
                homepage
              </a>
            </li>
            <li v-if="latestVersion?.bugs?.url">
              <a
                :href="latestVersion.bugs.url"
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
                rel="noopener noreferrer"
                class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              >
                <span class="i-carbon-cube w-4 h-4" />
                npm
              </a>
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
          <!-- Syntax highlighted install command -->
          <pre class="code-block"><code><span class="line"><ClientOnly><span class="text-syntax-fn">{{ selectedPMLabel }}</span><span class="text-syntax-str"> {{ selectedPMAction }}</span><span
            v-if="selectedPM !== 'deno'"
            class="text-syntax-str"
          > {{ pkg.name }}</span><span
            v-else
            class="text-syntax-str"
          >{{ pkg.name }}</span><template #fallback><span class="text-syntax-fn">npm</span><span class="text-syntax-str"> install</span><span class="text-syntax-str"> {{ pkg.name }}</span></template></ClientOnly></span></code></pre>
          <button
            class="absolute top-3 right-3 px-2 py-1 font-mono text-xs text-fg-muted bg-bg-elevated border border-border rounded transition-all duration-200 hover:(text-fg border-border-hover) active:scale-95"
            @click="copyInstallCommand"
          >
            <ClientOnly>
              {{ copied ? 'copied!' : 'copy' }}
              <template #fallback>
                copy
              </template>
            </ClientOnly>
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
            <!-- eslint-disable-next-line vue/no-v-html -- HTML is sanitized server-side -->
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
          <!-- Maintainers -->
          <section
            v-if="pkg.maintainers?.length"
            aria-labelledby="maintainers-heading"
          >
            <h2
              id="maintainers-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Maintainers
            </h2>
            <ul class="space-y-2 list-none m-0 p-0">
              <li
                v-for="maintainer in pkg.maintainers.slice(0, 5)"
                :key="maintainer.name ?? maintainer.email"
              >
                <a
                  v-if="maintainer.name"
                  :href="`https://www.npmjs.com/~${maintainer.name}`"
                  rel="noopener noreferrer"
                  class="link-subtle font-mono text-sm"
                >
                  @{{ maintainer.name }}
                </a>
                <span
                  v-else
                  class="font-mono text-sm text-fg-muted"
                >{{ maintainer.email }}</span>
              </li>
            </ul>
          </section>

          <!-- Keywords -->
          <section
            v-if="latestVersion?.keywords?.length"
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
                v-for="keyword in latestVersion.keywords.slice(0, 15)"
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

          <!-- Versions -->
          <section
            v-if="sortedVersions.length"
            aria-labelledby="versions-heading"
          >
            <h2
              id="versions-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Versions
            </h2>
            <div class="space-y-1">
              <div
                v-for="version in sortedVersions.slice(0, 10)"
                :key="version"
                class="flex items-center justify-between py-1.5 text-sm"
              >
                <NuxtLink
                  :to="`/package/${pkg.name}/v/${version}`"
                  class="font-mono text-fg-muted hover:text-fg transition-colors duration-200"
                >
                  {{ version }}
                  <span
                    v-if="pkg['dist-tags']?.latest === version"
                    class="ml-1 text-xs text-fg-subtle"
                  >(latest)</span>
                </NuxtLink>
                <time
                  v-if="pkg.time[version]"
                  :datetime="pkg.time[version]"
                  class="text-xs text-fg-subtle"
                >
                  {{ formatDate(pkg.time[version]) }}
                </time>
              </div>
            </div>
          </section>

          <!-- Dependencies -->
          <section
            v-if="latestVersion?.dependencies && Object.keys(latestVersion.dependencies).length > 0"
            aria-labelledby="dependencies-heading"
          >
            <h2
              id="dependencies-heading"
              class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
            >
              Dependencies ({{ Object.keys(latestVersion.dependencies).length }})
            </h2>
            <ul class="space-y-1 list-none m-0 p-0">
              <li
                v-for="(version, dep) in Object.fromEntries(Object.entries(latestVersion.dependencies).slice(0, 10))"
                :key="dep"
                class="flex items-center justify-between py-1 text-sm"
              >
                <NuxtLink
                  :to="`/package/${dep}`"
                  class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate mr-2"
                >
                  {{ dep }}
                </NuxtLink>
                <span class="font-mono text-xs text-fg-subtle shrink-0">{{ version }}</span>
              </li>
            </ul>
          </section>
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
