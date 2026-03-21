<script setup lang="ts">
import { ACCENT_COLOR_TOKENS, SHARE_CARD_THEMES } from '#shared/utils/constants'
import type { AccentColorId } from '#shared/utils/constants'

const props = withDefaults(
  defineProps<{
    name: string
    theme?: 'light' | 'dark'
    color?: string
  }>(),
  { theme: 'light' },
)

const t = computed(() => SHARE_CARD_THEMES[props.theme])
const primaryColor = computed(() => {
  const id = props.color as AccentColorId | undefined
  if (id && id in ACCENT_COLOR_TOKENS) {
    return ACCENT_COLOR_TOKENS[id][props.theme].hex
  }
  return ACCENT_COLOR_TOKENS.sky[props.theme].hex
})

const compactFormatter = useCompactNumberFormatter()
const bytesFormatter = useBytesFormatter()

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
const license = computed(() => pkg.value?.license ?? '')
const hasTypes = computed(() => Boolean(displayVersion.value?.types || displayVersion.value?.typings))
const moduleFormat = computed(() => (displayVersion.value?.type === 'module' ? 'ESM' : 'CJS'))
const depsCount = computed(() => Object.keys(displayVersion.value?.dependencies ?? {}).length)
const unpackedSize = computed(() => displayVersion.value?.dist?.unpackedSize ?? 0)
const publishedAt = computed(() => pkg.value?.time?.[version.value] ?? '')
const weeklyDownloads = computed(() => downloads.value?.downloads ?? 0)
const repoSlug = computed(() => {
  const ref = repoRef.value
  if (!ref) return ''
  return truncate(`${ref.owner}/${ref.repo}`, 26)
})

const fontSans = "'Geist', ui-sans-serif, sans-serif"
const fontMono = "'Geist Mono', ui-monospace, monospace"
</script>

<template>
  <!-- Rendered at 1280×520 (2.46:1). -->
  <div
    class="h-full w-full flex flex-col"
    :style="{
      backgroundColor: t.bg,
      color: t.text,
      fontFamily: fontSans,
    }"
  >
    <!-- ── Main content ─────────────────────────────────────────────── -->
    <div class="flex flex-row flex-1 overflow-hidden">
      <!-- Content column -->
      <div class="flex flex-col flex-1 overflow-hidden justify-between">
        <!-- Top content -->
        <div class="flex flex-col pt-8 pr-10 pl-8">
          <!-- Top row: name+version+latest ← → downloads — single baseline -->
          <div class="flex flex-row items-baseline justify-between mb-4">
            <!-- Left: name · version · latest -->
            <div class="flex flex-row items-baseline flex-wrap gap-[16px]">
              <span
                class="text-[48px] font-medium leading-none tracking-[-1px]"
                :style="{ fontFamily: fontMono }"
              >
                {{ truncate(name, 24) }}
              </span>
              <span
                class="text-[26px] font-light leading-none"
                :style="{ color: t.textMuted, fontFamily: fontMono }"
              >
                v{{ version }}
              </span>
              <span
                v-if="isLatest"
                class="flex items-center text-[20px] font-normal py-1 px-[14px] rounded-[20px] leading-[1.5] tracking-[0.04em]"
                :style="{
                  border: `1px solid ${withAlpha(primaryColor, 0.25)}`,
                  color: withAlpha(primaryColor, 0.9),
                }"
                >latest</span
              >
            </div>

            <!-- Right: weekly downloads — flat, single line -->
            <div class="flex flex-row items-baseline flex-shrink-0 gap-[10px]">
              <span
                class="text-[40px] font-medium leading-none tracking-[-1.5px]"
                :style="{ color: t.text, fontFamily: fontMono }"
              >
                {{ compactFormatter.format(weeklyDownloads) }}
              </span>
              <span class="text-[22px] font-light" :style="{ color: t.textMuted }">weekly</span>
            </div>
          </div>

          <!-- Description -->
          <div
            class="text-[22px] font-light leading-[1.6] mb-5"
            :style="{ color: t.textMuted, fontFamily: fontSans }"
          >
            {{ truncate(description || 'No description.', 440) }}
          </div>

          <!-- Tags -->
          <div class="flex flex-row flex-wrap gap-[16px]">
            <span
              v-if="hasTypes"
              class="flex items-center text-[20px] font-light py-1 px-[14px] rounded-[6px] leading-[1.6]"
              :style="{
                border: `1px solid ${t.borderMuted}`,
                color: t.textSubtle,
              }"
              >Types</span
            >
            <span
              class="flex items-center text-[20px] font-light py-1 px-[14px] rounded-[6px] leading-[1.6]"
              :style="{
                border: `1px solid ${t.borderMuted}`,
                color: t.textSubtle,
              }"
              >{{ moduleFormat }}</span
            >
            <span
              v-if="license"
              class="flex items-center text-[20px] font-light py-1 px-[14px] rounded-[6px] leading-[1.6]"
              :style="{
                border: `1px solid ${t.borderMuted}`,
                color: t.textSubtle,
              }"
              >{{ license }}</span
            >
            <span
              v-if="repoSlug"
              class="flex items-center text-[20px] font-light py-1 px-[14px] rounded-[6px] leading-[1.6]"
              :style="{
                border: `1px solid ${t.borderFaint}`,
                color: t.textFaint,
                fontFamily: fontMono,
              }"
              >{{ repoSlug }}</span
            >
          </div>
        </div>

        <!-- Bottom unified stats row -->
        <div class="flex flex-col justify-center flex-shrink-0 h-[132px] pr-10 pl-8">
          <div class="flex flex-row items-center gap-[42px]">
            <!-- Stars -->
            <div v-if="stars > 0" class="flex flex-row items-center gap-2">
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
                class="text-[24px] font-normal leading-none tracking-[-0.3px]"
                :style="{ color: t.textMuted }"
                >{{ compactFormatter.format(stars) }}</span
              >
            </div>

            <!-- Forks -->
            <div v-if="forks > 0" class="flex flex-row items-center gap-2">
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
                class="text-[24px] font-normal leading-none tracking-[-0.3px]"
                :style="{ color: t.textMuted }"
                >{{ compactFormatter.format(forks) }}</span
              >
            </div>

            <!-- Install Size -->
            <div class="flex flex-row items-center gap-2">
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
                class="text-[24px] font-normal leading-none tracking-[-0.3px]"
                :style="{ color: t.textMuted }"
                >{{ bytesFormatter.format(unpackedSize) }}</span
              >
            </div>

            <!-- Dependencies -->
            <div class="flex flex-row items-center gap-2">
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
                class="text-[24px] font-normal leading-none tracking-[-0.3px]"
                :style="{ color: t.textMuted }"
                >{{ depsCount }}</span
              >
            </div>

            <!-- Published -->
            <div v-if="publishedAt" class="flex flex-row items-center gap-2">
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
                class="text-[24px] font-normal leading-none tracking-[-0.3px]"
                :style="{ color: t.textMuted }"
                >{{ formatDate(publishedAt) }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Footer ────────────────────────────────────────────────────── -->
    <div
      class="flex flex-row items-center justify-between flex-shrink-0 py-4 pr-10 pl-8"
      :style="{
        borderTop: `1px solid ${t.border}`,
        backgroundColor: t.bg,
      }"
    >
      <div
        class="flex flex-row items-center text-[22px] font-light"
        :style="{ fontFamily: fontMono }"
      >
        <span class="font-medium -ml-1" :style="{ color: primaryColor }">.</span>/npmx
        <span class="ml-3 font-light" :style="{ color: t.textSubtle, fontFamily: fontSans }"
          >· npm package explorer</span
        >
      </div>
      <span class="text-[20px] font-light" :style="{ color: t.textSubtle, fontFamily: fontMono }">
        npmx.dev/package/{{ name }}
      </span>
    </div>
  </div>
</template>
