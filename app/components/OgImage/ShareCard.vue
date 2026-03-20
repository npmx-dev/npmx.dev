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

// Card: 1140×500 (2.28:1 ratio)
// Footer: ~42px. Main area: ~458px.
// BOTTOM_ROW_H: shared anchor for left meta stats + right stars/forks.
// Left panel uses justify-between so top content and bottom meta row
// sit at opposite ends — remaining space is distributed evenly in between
// rather than clumped as a single empty block above the meta row.
// Right panel: 360px wide, 24px padding each side → 312px sparkline width.
const BOTTOM_ROW_H = 110
const SPARK_W = 312
const SPARK_H = 75

const sparklinePoints = computed(() => {
  if (sparklineValues.length < 2) return ''
  const P = 3
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
  const P = 3
  return `${sparklinePoints.value} ${(SPARK_W - P).toFixed(1)},${SPARK_H} ${P},${SPARK_H}`
})
</script>

<template>
  <!--
    Rendered at 1140×600 (1.9:1).
    Left panel: justify-between so name/desc/tags block and meta-stats row
    sit at the two ends of the panel — no single collapsed spacer div,
    space is evenly distributed instead.
    Right panel: Weekly DL section is also justify-between, sparkline
    anchors to the bottom divider naturally.
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

      <!-- Left panel — justify-between keeps content at top, meta at bottom -->
      <div class="flex flex-col flex-1 overflow-hidden justify-between">
        <!-- Top content block: name + description + tags -->
        <div class="flex flex-col" style="padding: 24px 36px 0 32px">
          <!-- Name · version · latest badge -->
          <div class="flex flex-row items-end flex-wrap gap-[12px]" style="margin-bottom: 16px">
            <span :style="{ fontSize: '44px', fontWeight: 700, lineHeight: '1' }">
              <span :style="{ color: primaryColor, opacity: 0.75, marginRight: '-9px' }">.</span>/{{
                truncate(name, 28)
              }}
            </span>
            <span :style="{ fontSize: '22px', color: t.textMuted, lineHeight: '1' }"
              >v{{ version }}</span
            >
            <span
              v-if="isLatest"
              class="flex items-center"
              :style="{
                fontSize: '13px',
                fontWeight: 600,
                padding: '3px 11px',
                borderRadius: '5px',
                border: `1px solid ${withAlpha(primaryColor, 0.35)}`,
                color: primaryColor,
                lineHeight: '1.5',
              }"
              >latest</span
            >
          </div>

          <!-- Description -->
          <div
            :style="{
              fontSize: '16px',
              color: t.textMuted,
              lineHeight: '1.65',
              marginBottom: '18px',
            }"
          >
            {{ truncate(description || 'No description.', 200) }}
          </div>

          <!-- Tag chips -->
          <div class="flex flex-row flex-wrap gap-[10px]">
            <span
              v-if="hasTypes"
              class="flex items-center"
              :style="{
                fontSize: '13px',
                padding: '3px 11px',
                borderRadius: '4px',
                border: `1px solid ${t.border}`,
                color: t.textMuted,
                lineHeight: '1.6',
              }"
              >TypeScript</span
            >
            <span
              class="flex items-center"
              :style="{
                fontSize: '13px',
                padding: '3px 11px',
                borderRadius: '4px',
                border: `1px solid ${t.border}`,
                color: t.textMuted,
                lineHeight: '1.6',
              }"
              >{{ moduleFormat }}</span
            >
            <span
              v-if="license"
              class="flex items-center"
              :style="{
                fontSize: '13px',
                padding: '3px 11px',
                borderRadius: '4px',
                border: `1px solid ${t.border}`,
                color: t.textMuted,
                lineHeight: '1.6',
              }"
              >{{ license }}</span
            >
            <span
              v-if="repoSlug"
              class="flex items-center"
              :style="{
                fontSize: '13px',
                padding: '3px 11px',
                borderRadius: '4px',
                border: `1px solid ${t.border}`,
                color: t.textSubtle,
                lineHeight: '1.6',
              }"
              >{{ repoSlug }}</span
            >
          </div>
        </div>

        <!-- Meta stats — fixed height, aligned with Stars/Forks row -->
        <!-- No spacer div needed: justify-between on parent pushes this to bottom -->
        <div
          class="flex flex-col justify-center flex-shrink-0"
          :style="{
            height: `${BOTTOM_ROW_H}px`,
            borderTop: `1px solid ${t.divider}`,
            padding: '0 36px 0 32px',
          }"
        >
          <div class="flex flex-row" style="gap: 40px">
            <div class="flex flex-col" style="gap: 5px">
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: t.textSubtle,
                }"
                >Install Size</span
              >
              <span
                :style="{ fontSize: '26px', fontWeight: 600, color: t.text, lineHeight: '1' }"
                >{{ formatBytes(unpackedSize) }}</span
              >
            </div>
            <div class="flex flex-col" style="gap: 5px">
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: t.textSubtle,
                }"
                >Dependencies</span
              >
              <span
                :style="{ fontSize: '26px', fontWeight: 600, color: t.text, lineHeight: '1' }"
                >{{ depsCount }}</span
              >
            </div>
            <div v-if="publishedAt" class="flex flex-col" style="gap: 5px">
              <span
                :style="{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: t.textSubtle,
                }"
                >Published</span
              >
              <span
                :style="{ fontSize: '26px', fontWeight: 600, color: t.text, lineHeight: '1' }"
                >{{ formatDate(publishedAt) }}</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Vertical divider -->
      <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.border }" />

      <!-- Right stats panel — 360px wide -->
      <div class="flex flex-col flex-shrink-0" style="width: 360px">
        <!-- Weekly Downloads — justify-between so sparkline anchors to bottom divider -->
        <div class="flex flex-col flex-1 justify-between" style="padding: 22px 24px 18px">
          <!-- Label + number + date range -->
          <div class="flex flex-col">
            <span
              :style="{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: t.textSubtle,
                marginBottom: '8px',
              }"
              >Weekly DL</span
            >
            <span
              :style="{
                fontSize: '50px',
                fontWeight: 700,
                color: t.text,
                lineHeight: '1',
                marginBottom: '6px',
              }"
              >{{ formatNum(weeklyDownloads) }}</span
            >
            <span :style="{ fontSize: '13px', color: t.textSubtle }">{{ weekRange }}</span>
          </div>

          <!-- Sparkline — pushed to bottom of the flex-1 section -->
          <svg
            v-if="sparklinePoints"
            :width="SPARK_W"
            :height="SPARK_H"
            :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`"
            style="display: block"
          >
            <polyline
              :points="sparklineAreaPoints"
              :fill="withAlpha(primaryColor, 0.1)"
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
          <!-- Placeholder keeps layout stable when no sparkline data -->
          <div v-else :style="{ height: `${SPARK_H}px` }" />
        </div>

        <!-- Divider -->
        <div :style="{ height: '1px', backgroundColor: t.divider, flexShrink: 0 }" />

        <!-- Stars + Forks — fixed height matching left meta row -->
        <div class="flex flex-row flex-shrink-0" :style="{ height: `${BOTTOM_ROW_H}px` }">
          <!-- Stars -->
          <div class="flex flex-col justify-center" style="flex: 1; padding: 0 22px">
            <span
              :style="{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: t.textSubtle,
                marginBottom: '8px',
              }"
              >Stars</span
            >
            <span :style="{ fontSize: '38px', fontWeight: 700, color: t.text, lineHeight: '1' }">{{
              stars > 0 ? formatNum(stars) : '—'
            }}</span>
          </div>

          <!-- Divider -->
          <div class="flex-shrink-0" :style="{ width: '1px', backgroundColor: t.divider }" />

          <!-- Forks -->
          <div class="flex flex-col justify-center" style="flex: 1; padding: 0 22px">
            <span
              :style="{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: t.textSubtle,
                marginBottom: '8px',
              }"
              >Forks</span
            >
            <span :style="{ fontSize: '38px', fontWeight: 700, color: t.text, lineHeight: '1' }">{{
              forks > 0 ? formatNum(forks) : '—'
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────── -->
    <div
      class="flex flex-row items-center justify-between flex-shrink-0"
      :style="{
        padding: '12px 36px 12px 34px',
        borderTop: `1px solid ${t.border}`,
        backgroundColor: t.footerBg,
      }"
    >
      <div class="flex flex-row items-center" :style="{ fontSize: '15px' }">
        <span :style="{ color: primaryColor, fontWeight: 700 }">.</span>/npmx
        <span :style="{ color: t.textSubtle, marginLeft: '7px' }">· npm package explorer</span>
      </div>
      <span :style="{ fontSize: '13px', color: t.textSubtle }">npmx.dev/package/{{ name }}</span>
    </div>
  </div>
</template>
