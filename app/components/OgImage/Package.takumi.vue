<script lang="ts">
const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

const KIND_ICONS: Record<string, string> = {
  function: 'i-lucide:parentheses',
  class: 'i-lucide:box',
  interface: 'i-lucide:puzzle',
  typeAlias: 'i-lucide:type',
  variable: 'i-lucide:variable',
  enum: 'i-lucide:list',
  namespace: 'i-lucide:package',
}
</script>

<script setup lang="ts">
import type { JsDelivrFileNode } from '#shared/types'
import { joinURL } from 'ufo'
import { smoothPath, useCharts } from '~/composables/useCharts'

const REPO_PROVIDER_ICONS: Record<string, string> = {
  github: 'i-simple-icons:github',
  gitlab: 'i-simple-icons:gitlab',
  bitbucket: 'i-simple-icons:bitbucket',
  codeberg: 'i-simple-icons:codeberg',
  gitea: 'i-simple-icons:gitea',
  forgejo: 'i-simple-icons:forgejo',
  gitee: 'i-simple-icons:gitee',
  sourcehut: 'i-simple-icons:sourcehut',
  tangled: 'i-custom:tangled',
  radicle: 'i-lucide:network',
}

function sortJsDelivrNodes(nodes: JsDelivrFileNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

const { name, version, variant } = defineProps<{
  name: string
  version: string | null
  variant: 'download-chart' | 'code-tree' | 'function-tree'
}>()

const {
  data: resolvedVersion,
  status: versionStatus,
  error: versionError,
} = await useResolvedVersion(name, version)

if (
  versionStatus.value === 'error' &&
  versionError.value?.statusCode &&
  versionError.value.statusCode >= 400 &&
  versionError.value.statusCode < 500
) {
  throw createError({
    statusCode: 404,
  })
}

const { data: pkg, refresh: refreshPkg } = usePackage(name, () => resolvedVersion.value ?? version)
const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)

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

const { repoRef, stars, refresh: refreshRepoMeta } = useRepoMeta(repositoryUrl)
const repoProviderIcon = computed(() => {
  const provider = repoRef.value?.provider
  return provider ? (REPO_PROVIDER_ICONS[provider] ?? 'i-lucide:code') : 'i-lucide:code'
})

const formattedStars = computed(() => (stars.value > 0 ? compactFormat.format(stars.value) : ''))

const formattedDownloads = computed(() => {
  const last = weeklyValues.value.at(-1)
  return last ? compactFormat.format(last) : ''
})

const totalLikes = shallowRef(0)
const formattedLikes = computed(() =>
  totalLikes.value ? compactFormat.format(totalLikes.value) : '',
)

const pkgNameParts = computed(() => {
  const n = pkg.value?.name
  if (!n?.startsWith('@')) return { org: null, short: n }
  const slashIdx = n.indexOf('/')
  return { org: n.slice(0, slashIdx), short: n.slice(slashIdx + 1) }
})

// Fetch 52 weeks of download evolution for sparkline
const { fetchPackageDownloadEvolution } = useCharts()
const weeklyValues = shallowRef<number[]>([])

async function fetchWeeklyEvolution() {
  const evolution = await fetchPackageDownloadEvolution(name, null, {
    granularity: 'week',
    weeks: 52,
  }).catch(() => null)
  if (evolution?.length) {
    weeklyValues.value = evolution.map(w => w.value)
  }
}

// Flatten file tree into renderable rows for code-tree variant
interface TreeRow {
  name: string
  depth: number
  isDir: boolean
}
const treeRows = shallowRef<TreeRow[]>([])

async function fetchCodeTree() {
  const ver = resolvedVersion.value ?? version
  if (!ver) return

  // Call jsDelivr directly — $fetch to internal API can deadlock in OG image island context
  const resp = await $fetch<{ files: JsDelivrFileNode[] }>(
    `https://data.jsdelivr.com/v1/packages/npm/${name}@${ver}`,
    { timeout: 3000 },
  ).catch(() => null)
  if (!resp?.files) return

  const rows: TreeRow[] = []
  const MAX_ROWS = 25

  function walk(nodes: JsDelivrFileNode[], depth: number) {
    for (const node of sortJsDelivrNodes(nodes)) {
      if (rows.length >= MAX_ROWS) return
      rows.push({ name: node.name, depth, isDir: node.type === 'directory' })
      if (node.files) walk(node.files, depth + 1)
    }
  }
  walk(resp.files, 0)
  treeRows.value = rows
}

// Parse docs TOC HTML to extract API symbols for function-tree variant
interface SymbolRow {
  name: string
  kind: 'section' | 'symbol'
  icon: string
}
const symbolRows = shallowRef<SymbolRow[]>([])

const requestFetch = useRequestFetch()

async function fetchFunctionTree() {
  const ver = resolvedVersion.value ?? version
  if (!ver) return

  const resp = await requestFetch<{ toc: string | null }>(
    `/api/registry/docs/${name}/v/${ver}`,
  ).catch(() => null)
  if (!resp?.toc) return

  const rows: SymbolRow[] = []
  const MAX_ROWS = 25

  // Parse TOC HTML: sections have href="#section-{kind}", symbols have class="font-mono"
  const symbolRe = /<a href="#[^"]*"[^>]*font-mono[^>]*>([^<]+)<\/a>/g

  // Split TOC by <li> sections to preserve grouping
  const sectionBlocks = resp.toc.split(/<li>\s*<a href="#section-/)
  for (const block of sectionBlocks) {
    if (rows.length >= MAX_ROWS) break

    // Extract section kind and title
    const kindMatch = block.match(/^(\w+)"[^>]*>([^<]+)/)
    if (!kindMatch) continue

    const kind = kindMatch[1]!
    const title = kindMatch[2]!.trim()
    rows.push({ name: title, kind: 'section', icon: KIND_ICONS[kind] ?? 'i-lucide:code' })

    // Extract symbol names within this section
    const symbolMatches = block.matchAll(symbolRe)
    for (const m of symbolMatches) {
      if (rows.length >= MAX_ROWS) break
      rows.push({ name: m[1]!, kind: 'symbol', icon: KIND_ICONS[kind] ?? 'i-lucide:code' })
    }
  }
  symbolRows.value = rows
}

const fetchLikes = import.meta.test
  ? // need deterministic likes for testing
    Promise.resolve().then(() => {
      totalLikes.value = 83
    })
  : $fetch<{ totalLikes: number }>(`/api/social/likes/${name}`).then(d => {
      totalLikes.value = d?.totalLikes ?? 0
    })

try {
  await Promise.all([
    refreshPkg().then(() => refreshRepoMeta()),
    variant === 'code-tree'
      ? fetchCodeTree()
      : variant === 'function-tree'
        ? fetchFunctionTree()
        : undefined,
    fetchWeeklyEvolution(),
    fetchLikes,
  ])
} catch (err) {
  console.warn('[og-image-package] Failed to load data server-side:', err)
  throw createError({
    statusCode: 404,
  })
}

// Generate sparkline SVG as base64 data URL
const sparklineSrc = computed(() => {
  const values = weeklyValues.value
  if (values.length < 2) return ''

  const width = 500
  const height = 200
  const padY = 8

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  }))

  const pathData = smoothPath(points)
  const firstX = points[0]!.x
  const lastX = points.at(-1)!.x

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="none" preserveAspectRatio="none">`,
    `<defs><linearGradient id="af" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="white" stop-opacity="0.018"/>`,
    `<stop offset="100%" stop-color="white" stop-opacity="0.001"/>`,
    `</linearGradient></defs>`,
    `<path d="M ${firstX},${height} L ${pathData} L ${lastX},${height} Z" fill="url(#af)"/>`,
    `<path d="M ${pathData}" stroke="rgba(255,255,255,0.045)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    `</svg>`,
  ].join('')

  return `data:image/svg+xml;base64,${btoa(svg)}`
})
</script>

<template>
  <OgLayout data-theme="dark">
    <div class="px-15 py-12 flex flex-col justify-center gap-12 h-full">
      <OgBrand :height="48" />

      <div class="flex flex-col max-w-full gap-3">
        <div
          v-if="pkgNameParts.org"
          class="lg:text-5xl text-3xl font-mono tracking-tight leading-none"
          style="opacity: 0.5; text-overflow: ellipsis; line-clamp: 1"
        >
          {{ pkgNameParts.org }}
        </div>
        <div
          class="tracking-tighter font-mono leading-none overflow-hidden"
          :class="
            (pkgNameParts.short?.length ?? 0) > 20 ? 'lg:text-6xl text-4xl' : 'lg:text-7xl text-5xl'
          "
          style="text-overflow: ellipsis; line-clamp: 1; word-break: break-all"
        >
          {{ pkgNameParts.short }}
        </div>
        <div
          v-if="version"
          class="pt-3 lg:text-4xl text-3xl font-mono tracking-tight leading-none"
          style="opacity: 0.7; text-overflow: ellipsis; line-clamp: 1"
        >
          v{{ version }}
        </div>
      </div>

      <div class="flex flex-col gap-3 text-4xl text-fg-muted">
        <div v-if="repositoryUrl" class="flex items-center gap-2">
          <div
            :class="[repoProviderIcon, 'shrink-0 text-fg-muted']"
            style="width: 24px; height: 24px"
          />
          <span v-if="repoRef" class="max-w-[500px]" style="text-overflow: ellipsis">
            {{ repoRef.owner }}<span class="opacity-50">/</span>{{ repoRef.repo }}
          </span>
          <span v-else>{{ $t('package.links.repo') }}</span>
        </div>

        <div class="flex items-center gap-5">
          <span v-if="formattedDownloads" class="flex items-center gap-2" data-testid="downloads">
            <div
              class="i-lucide:download shrink-0 text-fg-muted"
              style="width: 24px; height: 24px"
            />
            <span>{{ formattedDownloads }}/wk</span>
          </span>

          <span v-if="formattedStars" class="flex items-center gap-2" data-testid="stars">
            <div
              class="i-lucide:star shrink-0 text-fg-muted"
              style="width: 24px; height: 24px; fill: white"
            />
            <span>{{ formattedStars }}</span>
          </span>

          <span v-if="formattedLikes" class="flex items-center gap-2" data-testid="likes">
            <div
              class="i-lucide:heart shrink-0 text-fg-muted"
              style="width: 24px; height: 24px; fill: white"
            />
            <span>{{ formattedLikes }}</span>
          </span>

          <div
            v-if="pkg?.license && !pkg.license.includes(' ')"
            class="flex items-center gap-2"
            data-testid="license"
          >
            <div
              class="i-lucide:scale shrink-0 text-fg-subtle self-center"
              style="width: 24px; height: 24px"
            />
            <span>{{ pkg.license }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Download chart variant -->
    <img
      v-if="variant === 'download-chart' && sparklineSrc"
      :src="sparklineSrc"
      class="absolute force-left-0 bottom-0 w-full h-[65%]"
    />

    <!-- Code tree variant -->
    <div
      v-else-if="variant === 'code-tree' && treeRows.length"
      class="text-fg-muted absolute force-right-8 top-8 bottom-8 w-[340px] flex flex-col gap-0 opacity-30 overflow-hidden font-mono text-4.5 leading-8"
    >
      <div
        v-for="(row, i) in treeRows"
        :key="i"
        class="flex items-center gap-3 whitespace-nowrap text-fg"
        :style="{ paddingLeft: `${row.depth * 20}px` }"
      >
        <div
          v-if="row.isDir"
          class="text-fg-muted shrink-0 i-lucide:folder"
          style="width: 20px; height: 20px"
        />
        <div
          v-else
          class="text-fg-muted shrink-0 i-lucide:file"
          style="width: 20px; height: 20px"
        />
        <span class="text-fg-muted">{{ row.name }}</span>
      </div>
    </div>

    <!-- Function tree variant (API symbols) -->
    <div
      v-else-if="variant === 'function-tree' && symbolRows.length"
      class="absolute force-right-8 top-8 bottom-8 w-[340px] flex flex-col gap-0 opacity-30 overflow-hidden font-mono text-4.5 leading-8"
    >
      <div
        v-for="(row, i) in symbolRows"
        :key="i"
        class="flex items-center gap-3 whitespace-nowrap text-fg"
        :style="{ paddingLeft: row.kind === 'symbol' ? '20px' : '0' }"
      >
        <div
          v-if="row.icon === 'i-lucide:parentheses'"
          class="shrink-0 text-fg-muted i-lucide:parentheses"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:box'"
          class="shrink-0 text-fg-muted i-lucide:box"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:puzzle'"
          class="shrink-0 text-fg-muted i-lucide:puzzle"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:type'"
          class="shrink-0 text-fg-muted i-lucide:type"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:variable'"
          class="shrink-0 text-fg-muted i-lucide:variable"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:list'"
          class="shrink-0 text-fg-muted i-lucide:list"
          style="width: 20px; height: 20px"
        />
        <div
          v-else-if="row.icon === 'i-lucide:package'"
          class="shrink-0 text-fg-muted i-lucide:package"
          style="width: 20px; height: 20px"
        />
        <div
          v-else
          class="shrink-0 text-fg-muted i-lucide:code"
          style="width: 20px; height: 20px"
        />
        <span class="text-fg-muted" :class="row.kind === 'section' ? 'text-4 mt-1' : ''">{{
          row.name
        }}</span>
      </div>
    </div>
  </OgLayout>
</template>
