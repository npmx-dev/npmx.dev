<script setup lang="ts">
import { ACCENT_COLOR_TOKENS, SHARE_CARD_THEMES } from '#shared/utils/constants'
import type { AccentColorId } from '#shared/utils/constants'

const props = withDefaults(
  defineProps<{
    name: string
    theme?: 'light' | 'dark'
    color?: string
  }>(),
  { theme: 'dark' },
)

const t = computed(() => SHARE_CARD_THEMES[props.theme])
const primaryColor = computed(() => {
  const id = props.color as AccentColorId | undefined
  if (id && id in ACCENT_COLOR_TOKENS) {
    return ACCENT_COLOR_TOKENS[id][props.theme].hex
  }
  return ACCENT_COLOR_TOKENS.sky[props.theme].hex
})

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

// Card: 1280×520 (2.46:1) — same ratio as 640×260, doubled for sharpness.
// Single-column layout: accent bar + full-width content.
// Typography hierarchy (two weights only):
//   500 — primary values: package name, weekly DL, bottom stats
//   300 — secondary: version, description, tags, footer text
//   400 — labels only (18px uppercase tracked)
const BOTTOM_ROW_H = 132
</script>

<template>
  <!--
    Rendered at 1280×520 (2.46:1).
    Flat single-column layout — no left/right panel split.
    Top row: package identity (left) + weekly downloads (right) on one baseline.
    Bottom row: all stats unified in a single row.
  -->
  <div
    class="h-full w-full flex flex-col"
    :style="{
      backgroundColor: t.bg,
      color: t.text,
      fontFamily: '\'Geist Mono\', ui-monospace, monospace',
    }"
  >
    <!-- ── Main content ─────────────────────────────────────────────── -->
    <div class="flex flex-row flex-1 overflow-hidden">
      <!-- Content column -->
      <div class="flex flex-col flex-1 overflow-hidden justify-between">
        <!-- Top content -->
        <div class="flex flex-col" style="padding: 32px 40px 0 32px">
          <!-- Top row: name+version+latest ← → downloads — single baseline -->
          <div class="flex flex-row items-baseline justify-between" style="margin-bottom: 16px">
            <!-- Left: name · version · latest -->
            <div class="flex flex-row items-baseline flex-wrap gap-[16px]">
              <span
                :style="{
                  fontSize: '48px',
                  fontWeight: 500,
                  lineHeight: '1',
                  letterSpacing: '-1px',
                }"
              >
                {{ truncate(name, 24) }}
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

            <!-- Right: weekly downloads — flat, single line -->
            <div class="flex flex-row items-baseline flex-shrink-0" style="gap: 10px">
              <span
                :style="{
                  fontSize: '40px',
                  fontWeight: 500,
                  color: t.text,
                  lineHeight: '1',
                  letterSpacing: '-1.5px',
                }"
                >{{ formatNum(weeklyDownloads) }}</span
              >
              <span
                :style="{
                  fontSize: '20px',
                  fontWeight: 300,
                  color: t.textSubtle,
                }"
                >weekly</span
              >
            </div>
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
            {{ truncate(description || 'No description.', 440) }}
          </div>

          <!-- Tags -->
          <div class="flex flex-row flex-wrap gap-[16px]">
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
              >Types</span
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
                border: `1px solid ${withAlpha(t.border, 0.5)}`,
                color: withAlpha(t.textSubtle, 0.8),
                lineHeight: '1.6',
              }"
              >{{ repoSlug }}</span
            >
          </div>
        </div>

        <!-- Bottom unified stats row -->
        <div
          class="flex flex-col justify-center flex-shrink-0"
          :style="{
            height: `${BOTTOM_ROW_H}px`,
            padding: '0 40px 0 32px',
          }"
        >
          <div class="flex flex-row items-center gap-[42px]">
            <!-- Stars -->
            <div v-if="stars > 0" class="flex flex-row items-center gap-[8px]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                :stroke="t.textSubtle"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"
                />
              </svg>
              <span
                :style="{
                  fontSize: '24px',
                  fontWeight: 400,
                  color: t.textMuted,
                  lineHeight: '1',
                  letterSpacing: '-0.3px',
                }"
                >{{ formatNum(stars) }}</span
              >
            </div>

            <!-- Forks -->
            <div v-if="forks > 0" class="flex flex-row items-center" style="gap: 8px">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                :stroke="t.textSubtle"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9m6 3v3" />
              </svg>
              <span
                :style="{
                  fontSize: '24px',
                  fontWeight: 400,
                  color: t.textMuted,
                  lineHeight: '1',
                  letterSpacing: '-0.3px',
                }"
                >{{ formatNum(forks) }}</span
              >
            </div>

            <!-- Install Size -->
            <div class="flex flex-row items-center" style="gap: 8px">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                :stroke="t.textSubtle"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zm1 .27V12"
                />
                <path d="M3.29 7L12 12l8.71-5M7.5 4.27l9 5.15" />
              </svg>
              <span
                :style="{
                  fontSize: '24px',
                  fontWeight: 400,
                  color: t.textMuted,
                  lineHeight: '1',
                  letterSpacing: '-0.3px',
                }"
                >{{ formatBytes(unpackedSize) }}</span
              >
            </div>

            <!-- Dependencies -->
            <div class="flex flex-row items-center" style="gap: 8px">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                :stroke="t.textSubtle"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span
                :style="{
                  fontSize: '24px',
                  fontWeight: 400,
                  color: t.textMuted,
                  lineHeight: '1',
                  letterSpacing: '-0.3px',
                }"
                >{{ depsCount }}</span
              >
            </div>

            <!-- Published -->
            <div v-if="publishedAt" class="flex flex-row items-center" style="gap: 8px">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                :stroke="t.textSubtle"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 2v4m8-4v4" />
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M3 10h18" />
              </svg>
              <span
                :style="{
                  fontSize: '24px',
                  fontWeight: 400,
                  color: t.textMuted,
                  lineHeight: '1',
                  letterSpacing: '-0.3px',
                }"
                >{{ formatDate(publishedAt) }}</span
              >
            </div>
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
        backgroundColor: t.bg,
      }"
    >
      <div class="flex flex-row items-center" :style="{ fontSize: '22px', fontWeight: 300 }">
        <span :style="{ color: primaryColor, fontWeight: 500, marginLeft: '-4px' }">.</span>/npmx
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
