<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string
    theme?: 'light' | 'dark'
    primaryColor?: string
  }>(),
  { theme: 'dark', primaryColor: '#5bc8e8' },
)

const THEMES = {
  dark: {
    bg: '#0d0d0d',
    border: '#252525',
    divider: '#1a1a1a',
    text: '#f0f0f0',
    textMuted: '#9a9a9a',
    textSubtle: '#565656',
    footerBg: '#111111',
  },
  light: {
    bg: '#fafaf9',
    border: '#e0ddd8',
    divider: '#ebebea',
    text: '#1a1a1a',
    textMuted: '#606060',
    textSubtle: '#9a9898',
    footerBg: '#f0efed',
  },
} as const

const t = computed(() => THEMES[props.theme])
const primaryColor = computed(() => props.primaryColor || '#5bc8e8')

// Blend primaryColor with alpha for satori (works for both hex and oklch)
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('oklch(')) return color.replace(')', ` / ${alpha})`)
  if (color.startsWith('#')) return color + Math.round(alpha * 255).toString(16).padStart(2, '0')
  return color
}

function formatNum(n: number) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

function formatBytes(bytes: number) {
  if (!+bytes) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB'] as const
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Data
const { data: resolvedVersion } = await useResolvedVersion(computed(() => props.name), null)
const { data: pkg, refresh: refreshPkg } = usePackage(
  computed(() => props.name),
  () => resolvedVersion.value ?? null,
)
const { data: downloads, refresh: refreshDownloads } = usePackageDownloads(
  computed(() => props.name),
  'last-week',
)
const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)
const { repositoryUrl } = useRepositoryUrl(displayVersion)
const { stars, repoRef, refresh: refreshRepoMeta } = useRepoMeta(repositoryUrl)

try {
  await refreshPkg()
  await Promise.all([refreshRepoMeta(), refreshDownloads()])
} catch (err) {
  console.warn('[share-card] Failed to load data server-side:', err)
}

// Per-day sparkline
let sparklineValues: number[] = []
try {
  const result = await $fetch<{ downloads: Array<{ downloads: number }> }>(
    `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(props.name)}`,
  )
  sparklineValues = result.downloads?.map(d => d.downloads) ?? []
} catch { /* decorative — omit on failure */ }

// Dependents
let dependents = 0
try {
  const result = await $fetch<{ total: number }>(
    `https://registry.npmjs.org/-/v1/search?text=dependencies%3A${encodeURIComponent(props.name)}&size=0`,
  )
  dependents = result.total ?? 0
} catch { /* show nothing on failure */ }

// Derived
const version = computed(() => resolvedVersion.value ?? pkg.value?.['dist-tags']?.latest ?? '')
const isLatest = computed(() => pkg.value?.['dist-tags']?.latest === version.value)
const description = computed(() => pkg.value?.description ?? '')
const license = computed(() => (pkg.value?.license as string | undefined) ?? '')
const hasTypes = computed(() => !!(displayVersion.value?.types || displayVersion.value?.typings))
const moduleFormat = computed(() => (displayVersion.value?.type === 'module' ? 'ESM' : 'CJS'))
const depsCount = computed(() => Object.keys(displayVersion.value?.dependencies ?? {}).length)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unpackedSize = computed(() => (displayVersion.value?.dist as any)?.unpackedSize ?? 0)
const publishedAt = computed(
  () => pkg.value?.time?.[version.value] ?? pkg.value?.time?.modified ?? '',
)
const weeklyDownloads = computed(() => downloads.value?.downloads ?? 0)
const repoSlug = computed(() => {
  const ref = repoRef.value
  if (!ref) return ''
  return truncate(`${ref.owner}/${ref.repo}`, 26)
})

// Last-week date range label
const weekRange = computed(() => {
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
})

// Sparkline — right panel is 400px, 36px padding each side → 328px content, 80px tall
const sparklinePoints = computed(() => {
  if (sparklineValues.length < 2) return ''
  const W = 328, H = 80, P = 4
  const max = Math.max(...sparklineValues)
  const min = Math.min(...sparklineValues)
  const range = max - min || 1
  return sparklineValues
    .map((v, i) => {
      const x = P + (i / (sparklineValues.length - 1)) * (W - P * 2)
      const y = H - P - ((v - min) / range) * (H - P * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

// Area fill: close the polyline at the bottom corners
const sparklineAreaPoints = computed(() => {
  if (!sparklinePoints.value) return ''
  const W = 328, H = 80, P = 4
  return `${sparklinePoints.value} ${(W - P).toFixed(1)},${H} ${P},${H}`
})
</script>

<template>
  <!--
    Rendered at 2400×840 (2× HiDPI). Tailwind for layout; inline :style for
    dynamic theme colours / pixel values only.
  -->
  <div
    class="h-full w-full flex flex-col"
    :style="{ backgroundColor: t.bg, color: t.text, fontFamily: '\'Geist Mono\', ui-monospace, monospace' }"
  >
    <!-- ── Main row ─────────────────────────────────────────────────── -->
    <div class="flex flex-row flex-1">

      <!-- 3px accent bar (6px at 2×) -->
      <div class="flex-shrink-0" :style="{ width: '6px', backgroundColor: primaryColor }" />

      <!-- Left panel — justify-between pushes meta stats to bottom -->
      <div class="flex flex-col flex-1 justify-between relative" style="padding: 60px 64px 52px 60px">

        <!-- Glow blob (decorative, top-right of left panel) -->
        <div
          class="absolute"
          :style="{
            top: '-160px',
            right: '-80px',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            backgroundColor: withAlpha(primaryColor, 0.1),
            filter: 'blur(80px)',
          }"
        />

        <!-- TOP GROUP: name + description + chips -->
        <div class="flex flex-col" style="gap: 0">

          <!-- Name · version · latest badge -->
          <div class="flex flex-row items-center flex-wrap" style="gap: 20px; margin-bottom: 28px">
            <span :style="{ fontSize: '68px', fontWeight: 700, lineHeight: '1' }">
              <span :style="{ color: primaryColor, opacity: 0.75 }">./</span>{{ truncate(name, 32) }}
            </span>
            <span :style="{ fontSize: '30px', color: t.textMuted, lineHeight: '1' }">v{{ version }}</span>
            <span
              v-if="isLatest"
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 600,
                padding: '4px 18px',
                borderRadius: '6px',
                border: `1px solid ${withAlpha(primaryColor, 0.35)}`,
                color: primaryColor,
                lineHeight: '1.5',
              }"
            >latest</span>
          </div>

          <!-- Description -->
          <div :style="{ fontSize: '26px', color: t.textMuted, lineHeight: '1.55', marginBottom: '28px' }">
            {{ truncate(description || 'No description.', 110) }}
          </div>

          <!-- Tag chips -->
          <div class="flex flex-row flex-wrap" style="gap: 10px">
            <span
              v-if="hasTypes"
              class="flex items-center"
              :style="{ fontSize: '18px', padding: '4px 16px', borderRadius: '4px', border: `1px solid ${t.border}`, color: t.textMuted, lineHeight: '1.6' }"
            >✓ TypeScript</span>
            <span
              class="flex items-center"
              :style="{ fontSize: '18px', padding: '4px 16px', borderRadius: '4px', border: `1px solid ${t.border}`, color: t.textMuted, lineHeight: '1.6' }"
            >{{ moduleFormat }}</span>
            <span
              v-if="license"
              class="flex items-center"
              :style="{ fontSize: '18px', padding: '4px 16px', borderRadius: '4px', border: `1px solid ${t.border}`, color: t.textMuted, lineHeight: '1.6' }"
            >{{ license }}</span>
            <span
              v-if="repoSlug"
              class="flex items-center"
              :style="{ fontSize: '18px', padding: '4px 16px', borderRadius: '4px', border: `1px solid ${t.border}`, color: t.textSubtle, lineHeight: '1.6' }"
            >{{ repoSlug }}</span>
          </div>
        </div>

        <!-- BOTTOM GROUP: divider + meta stats -->
        <div class="flex flex-col">
          <div class="w-full" :style="{ height: '1px', backgroundColor: t.divider, marginBottom: '32px' }" />
          <div class="flex flex-row" style="gap: 56px">
            <div class="flex flex-col" style="gap: 8px">
              <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle }">Install Size</span>
              <span :style="{ fontSize: '32px', fontWeight: 600, color: t.text }">{{ formatBytes(unpackedSize) }}</span>
            </div>
            <div class="flex flex-col" style="gap: 8px">
              <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle }">Dependencies</span>
              <span :style="{ fontSize: '32px', fontWeight: 600, color: t.text }">{{ depsCount }}</span>
            </div>
            <div v-if="publishedAt" class="flex flex-col" style="gap: 8px">
              <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle }">Published</span>
              <span :style="{ fontSize: '32px', fontWeight: 600, color: t.text }">{{ formatDate(publishedAt) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Vertical divider -->
      <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.border }" />

      <!-- Right stats panel (400px) -->
      <div class="flex flex-col flex-shrink-0" style="width: 400px">

        <!-- Weekly Downloads (takes all remaining space above) -->
        <div class="flex flex-col flex-1 justify-center" style="padding: 40px 36px 28px">
          <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle, marginBottom: '10px' }">Weekly DL</span>
          <span :style="{ fontSize: '76px', fontWeight: 700, color: t.text, lineHeight: '1', marginBottom: '8px' }">{{ formatNum(weeklyDownloads) }}</span>
          <span :style="{ fontSize: '18px', color: t.textSubtle, marginBottom: '18px' }">{{ weekRange }}</span>
          <!-- Sparkline with area fill -->
          <svg v-if="sparklinePoints" width="328" height="80" viewBox="0 0 328 80" style="display: block">
            <polyline
              :points="sparklineAreaPoints"
              :fill="withAlpha(primaryColor, 0.1)"
              stroke="none"
            />
            <polyline
              :points="sparklinePoints"
              fill="none"
              :stroke="primaryColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <!-- Divider -->
        <div :style="{ height: '1px', backgroundColor: t.divider }" />

        <!-- GitHub Stars + Dependents side by side (fixed height) -->
        <div class="flex flex-row flex-shrink-0" style="height: 260px">

          <!-- Stars -->
          <div class="flex flex-col flex-1 justify-center" style="padding: 28px 28px">
            <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle, marginBottom: '10px' }">Stars</span>
            <span :style="{ fontSize: '54px', fontWeight: 700, color: t.text, lineHeight: '1' }">{{ stars > 0 ? formatNum(stars) : '—' }}</span>
          </div>

          <!-- Divider -->
          <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.divider }" />

          <!-- Dependents -->
          <div class="flex flex-col flex-1 justify-center" style="padding: 28px 28px">
            <span :style="{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textSubtle, marginBottom: '10px' }">Deps on</span>
            <span :style="{ fontSize: '54px', fontWeight: 700, color: t.text, lineHeight: '1' }">{{ dependents > 0 ? formatNum(dependents) : '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────── -->
    <div
      class="flex flex-row items-center justify-between flex-shrink-0"
      :style="{ padding: '20px 52px 20px 48px', borderTop: `1px solid ${t.border}`, backgroundColor: t.footerBg }"
    >
      <div class="flex flex-row items-center" :style="{ fontSize: '22px' }">
        <span :style="{ color: primaryColor, fontWeight: 700 }">./npmx</span>
        <span :style="{ color: t.textSubtle, marginLeft: '10px' }">· npm package explorer</span>
      </div>
      <span :style="{ fontSize: '20px', color: t.textSubtle }">npmx.dev/package/{{ name }}</span>
    </div>
  </div>
</template>
