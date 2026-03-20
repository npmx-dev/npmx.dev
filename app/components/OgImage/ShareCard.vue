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
    footerBg: '#0d0d0d',
  },
  light: {
    bg: '#fafaf9',
    border: '#e0ddd8',
    divider: '#ebebea',
    text: '#1a1a1a',
    textMuted: '#606060',
    textSubtle: '#9a9898',
    footerBg: '#fafaf9',
  },
} as const

const t = computed(() => THEMES[props.theme])
// const primaryColor = computed(() => props.primaryColor || '#006fc2')
const primaryColor = '#006fc2'
console.log('color: ', props.primaryColor)

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('oklch(')) return color.replace(')', ` / ${alpha})`)
  if (color.startsWith('#'))
    return (
      color +
      Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')
    )
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

const { data: resolvedVersion } = await useResolvedVersion(
  computed(() => props.name),
  null,
)
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
const { stars, forks, repoRef, refresh: refreshRepoMeta } = useRepoMeta(repositoryUrl)

try {
  await refreshPkg()
  await Promise.all([refreshRepoMeta(), refreshDownloads()])
} catch (err) {
  console.warn('[share-card] Failed to load data server-side:', err)
}

let sparklineValues: number[] = []
try {
  const endDate = new Date()
  endDate.setDate(endDate.getDate() - 1)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (52 * 7 - 1))
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
  const result = await $fetch<{ downloads: Array<{ downloads: number }> }>(
    `https://api.npmjs.org/downloads/range/${fmtDate(startDate)}:${fmtDate(endDate)}/${encodeURIComponent(props.name)}`,
  )
  const daily = result.downloads ?? []
  for (let i = 0; i < daily.length; i += 7) {
    sparklineValues.push(daily.slice(i, i + 7).reduce((sum, d) => sum + d.downloads, 0))
  }
} catch {
  /* decorative — omit on failure */
}

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

const weekRange = computed(() => {
  const end = new Date()
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
})

// Card: 1280×520 (2.46:1) — same ratio as 640×260, doubled for sharpness.
// Footer ~68px. Main area ~452px.
// Right panel: 400px wide, 32px padding → 336px sparkline width.
// Weights: 300 (secondary), 400 (labels), 500 (primary values).
const BOTTOM_ROW_H = 132
const SPARK_W = 336
const SPARK_H = 96

const sparklinePoints = computed(() => {
  if (sparklineValues.length < 2) return ''
  const P = 4
  const max = Math.max(...sparklineValues)
  const min = Math.min(...sparklineValues)
  const range = max - min || 1
  return sparklineValues
    .map((v, i) => {
      const x = P + (i / (sparklineValues.length - 1)) * (SPARK_W - P * 2)
      const y = SPARK_H - P - ((v - min) / range) * (SPARK_H - P * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const sparklineAreaPoints = computed(() => {
  if (!sparklinePoints.value) return ''
  const P = 4
  return `${sparklinePoints.value} ${(SPARK_W - P).toFixed(1)},${SPARK_H} ${P},${SPARK_H}`
})
</script>

<template>
  <!--
    Rendered at 1280×520 (2.46:1).
    Same proportions as 640×260 but 2× the pixels — sharp at any display size.
    Typography hierarchy (two weights only):
      500 — primary values: package name, weekly DL, stars, forks, bottom stats
      300 — secondary: version, description, tags, date range, footer text
      400 — labels only (18px uppercase tracked)
  -->
  <div
    class="h-full w-full flex flex-col"
    :style="{
      backgroundColor: t.bg,
      color: t.text,
      fontFamily: '\'Geist Mono\', ui-monospace, monospace',
    }"
  >
    <!-- ── Main row ─────────────────────────────────────────────────── -->
    <div class="flex flex-row flex-1 overflow-hidden">
      <!-- 4px accent bar -->
      <div class="flex-shrink-0" :style="{ width: '4px', backgroundColor: primaryColor }" />

      <!-- Left panel -->
      <div class="flex flex-col flex-1 overflow-hidden justify-between">
        <!-- Top content -->
        <div class="flex flex-col" style="padding: 32px 40px 0 32px">
          <!-- Name · version · latest -->
          <div
            class="flex flex-row items-baseline flex-wrap gap-[16px]"
            style="margin-bottom: 16px"
          >
            <span
              :style="{
                fontSize: '48px',
                fontWeight: 500,
                lineHeight: '1',
                letterSpacing: '-1px',
              }"
            >
              <span :style="{ color: primaryColor, opacity: 0.6, marginRight: '-10px' }">.</span>/{{
                truncate(name, 24)
              }}
            </span>
            <span
              :style="{
                fontSize: '26px',
                fontWeight: 300,
                color: t.textMuted,
                lineHeight: '1',
              }"
              >v{{ version }}</span
            >
            <span
              v-if="isLatest"
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 400,
                padding: '4px 14px',
                borderRadius: '20px',
                border: `1px solid ${withAlpha(primaryColor, 0.25)}`,
                color: withAlpha(primaryColor, 0.7),
                lineHeight: '1.5',
                letterSpacing: '0.04em',
              }"
              >latest</span
            >
          </div>

          <!-- Description -->
          <div
            :style="{
              fontSize: '22px',
              fontWeight: 300,
              color: t.textMuted,
              lineHeight: '1.6',
              marginBottom: '20px',
            }"
          >
            {{ truncate(description || 'No description.', 140) }}
          </div>

          <!-- Tags -->
          <div class="flex flex-row flex-wrap gap-[10px]">
            <span
              v-if="hasTypes"
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 300,
                padding: '4px 14px',
                borderRadius: '6px',
                border: `1px solid ${withAlpha(t.border, 0.6)}`,
                color: t.textSubtle,
                lineHeight: '1.6',
              }"
              >TypeScript</span
            >
            <span
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 300,
                padding: '4px 14px',
                borderRadius: '6px',
                border: `1px solid ${withAlpha(t.border, 0.6)}`,
                color: t.textSubtle,
                lineHeight: '1.6',
              }"
              >{{ moduleFormat }}</span
            >
            <span
              v-if="license"
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 300,
                padding: '4px 14px',
                borderRadius: '6px',
                border: `1px solid ${withAlpha(t.border, 0.6)}`,
                color: t.textSubtle,
                lineHeight: '1.6',
              }"
              >{{ license }}</span
            >
            <span
              v-if="repoSlug"
              class="flex items-center"
              :style="{
                fontSize: '20px',
                fontWeight: 300,
                padding: '4px 14px',
                borderRadius: '6px',
                border: `1px solid ${withAlpha(t.border, 0.4)}`,
                color: withAlpha(t.textSubtle, 0.6),
                lineHeight: '1.6',
              }"
              >{{ repoSlug }}</span
            >
          </div>
        </div>

        <!-- Bottom meta stats -->
        <div
          class="flex flex-col justify-center flex-shrink-0"
          :style="{
            height: `${BOTTOM_ROW_H}px`,
            borderTop: `1px solid ${t.divider}`,
            padding: '0 40px 0 32px',
          }"
        >
          <div class="flex flex-row" style="gap: 48px">
            <div class="flex flex-col" style="gap: 8px">
              <span
                :style="{
                  fontSize: '18px',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: t.textSubtle,
                }"
                >Install Size</span
              >
              <span
                :style="{
                  fontSize: '28px',
                  fontWeight: 500,
                  color: t.text,
                  lineHeight: '1',
                  letterSpacing: '-0.4px',
                }"
                >{{ formatBytes(unpackedSize) }}</span
              >
            </div>
            <div class="flex flex-col" style="gap: 8px">
              <span
                :style="{
                  fontSize: '18px',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: t.textSubtle,
                }"
                >Dependencies</span
              >
              <span
                :style="{
                  fontSize: '28px',
                  fontWeight: 500,
                  color: t.text,
                  lineHeight: '1',
                  letterSpacing: '-0.4px',
                }"
                >{{ depsCount }}</span
              >
            </div>
            <div v-if="publishedAt" class="flex flex-col" style="gap: 8px">
              <span
                :style="{
                  fontSize: '18px',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: t.textSubtle,
                }"
                >Published</span
              >
              <span
                :style="{
                  fontSize: '28px',
                  fontWeight: 500,
                  color: t.text,
                  lineHeight: '1',
                  letterSpacing: '-0.4px',
                }"
                >{{ formatDate(publishedAt) }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Vertical divider -->
      <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.border }" />

      <!-- Right panel — 400px -->
      <div class="flex flex-col flex-shrink-0" style="width: 400px">
        <!-- Weekly Downloads -->
        <div class="flex flex-col flex-1 justify-between" style="padding: 28px 32px 24px">
          <div class="flex flex-col">
            <span
              :style="{
                fontSize: '18px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: t.textSubtle,
                marginBottom: '8px',
              }"
              >Weekly DL</span
            >
            <span
              :style="{
                fontSize: '60px',
                fontWeight: 500,
                color: t.text,
                lineHeight: '1',
                letterSpacing: '-2px',
                marginBottom: '6px',
              }"
              >{{ formatNum(weeklyDownloads) }}</span
            >
            <span
              :style="{
                fontSize: '20px',
                fontWeight: 300,
                color: t.textSubtle,
              }"
              >{{ weekRange }}</span
            >
          </div>

          <!-- Sparkline -->
          <svg
            v-if="sparklinePoints"
            :width="SPARK_W"
            :height="SPARK_H"
            :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
            style="display: block"
          >
            <polyline
              :points="sparklineAreaPoints"
              :fill="withAlpha(primaryColor, 0.08)"
              stroke="none"
            />
            <polyline
              :points="sparklinePoints"
              fill="none"
              :stroke="primaryColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div v-else :style="{ height: `${SPARK_H}px` }" />
        </div>

        <!-- Divider -->
        <div :style="{ height: '1px', backgroundColor: t.divider, flexShrink: 0 }" />

        <!-- Stars + Forks -->
        <div class="flex flex-row flex-shrink-0" :style="{ height: `${BOTTOM_ROW_H}px` }">
          <div class="flex flex-col justify-center" style="flex: 1; padding: 0 28px">
            <span
              :style="{
                fontSize: '18px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: t.textSubtle,
                marginBottom: '10px',
              }"
              >Stars</span
            >
            <span
              :style="{
                fontSize: '40px',
                fontWeight: 500,
                color: t.text,
                lineHeight: '1',
                letterSpacing: '-0.6px',
              }"
              >{{ stars > 0 ? formatNum(stars) : '—' }}</span
            >
          </div>

          <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.divider }" />

          <div class="flex flex-col justify-center" style="flex: 1; padding: 0 28px">
            <span
              :style="{
                fontSize: '18px',
                fontWeight: 400,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: t.textSubtle,
                marginBottom: '10px',
              }"
              >Forks</span
            >
            <span
              :style="{
                fontSize: '40px',
                fontWeight: 500,
                color: t.text,
                lineHeight: '1',
                letterSpacing: '-0.6px',
              }"
              >{{ forks > 0 ? formatNum(forks) : '—' }}</span
            >
          </div>
        </div>
      </div>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────── -->
    <div
      class="flex flex-row items-center justify-between flex-shrink-0"
      :style="{
        padding: '16px 40px 16px 32px',
        borderTop: `1px solid ${t.border}`,
        backgroundColor: t.footerBg,
      }"
    >
      <div class="flex flex-row items-center" :style="{ fontSize: '22px', fontWeight: 300 }">
        <span :style="{ color: primaryColor, fontWeight: 500 }">.</span>/npmx
        <span :style="{ color: t.textSubtle, marginLeft: '12px', fontWeight: 300 }"
          >· npm package explorer</span
        >
      </div>
      <span :style="{ fontSize: '20px', fontWeight: 300, color: t.textSubtle }">
        npmx.dev/package/{{ name }}
      </span>
    </div>
  </div>
</template>
