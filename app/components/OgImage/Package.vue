<script setup lang="ts">
interface Props {
  name: string
  version: string
  downloads?: string
  license?: string
  primaryColor?: string
  description?: string
  repoOwner?: string
  repoName?: string
  stars?: number
  forks?: number
  directDepsCount?: number
  updatedAt?: string
  hasTypes?: boolean
  hasESM?: boolean
  hasCJS?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  downloads: '',
  license: '',
  primaryColor: '#60a5fa',
  description: '',
  repoOwner: '',
  repoName: '',
  stars: 0,
  forks: 0,
  directDepsCount: 0,
  updatedAt: '',
  hasTypes: false,
  hasESM: false,
  hasCJS: false,
})

// Dynamic font sizing based on name length
// OG images are 1200px wide, with 64px padding on each side = 1072px content width
// Icon is 80px + 24px gap = 104px, leaving ~968px for name + version
const titleFontSize = computed(() => {
  const len = props.name.length
  if (len <= 12) return 96 // text-8xl
  if (len <= 18) return 80
  if (len <= 24) return 64
  if (len <= 32) return 52
  if (len <= 40) return 44
  return 36 // very long names
})

const versionFontSize = computed(() => {
  // Version scales proportionally but stays readable
  const base = titleFontSize.value
  return Math.max(42, Math.round(base * 0.5))
})

const truncatedVersion = computed(() => {
  const v = props.version
  if (v.length <= 12) return v
  return v.slice(0, 11) + '…'
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-between px-16 py-14 bg-[#050505] text-[#fafafa] relative overflow-hidden"
    style="font-family: 'Geist', sans-serif"
  >
    <!-- Top section -->
    <div class="relative z-10 flex flex-col gap-4">
      <!-- Short name layout: icon + ./name + version in one row -->
      <div v-if="props.name.length < 24" class="flex flex-row items-end gap-6 align-baseline mb-6">
        <div
          class="w-20 h-20 rounded-xl shadow-lg flex items-center justify-center"
          :style="{ backgroundColor: props.primaryColor }"
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            :style="{ marginTop: '36px' }"
          >
            <path d="m7.5 4.27 9 5.15" />
            <path
              d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
            />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </div>

        <h1
          class="font-bold tracking-tight leading-none mt-0"
          :style="{ fontSize: `${titleFontSize}px`, marginBottom: '-8px' }"
        >
          <span class="opacity-80" :style="{ color: props.primaryColor }">./</span>{{ props.name }}
        </h1>

        <span class="pb-1" :style="{ fontSize: `${versionFontSize}px`, color: props.primaryColor }">
          v{{ truncatedVersion }}
        </span>
      </div>

      <!-- Long name layout: icon + name on first row, version below -->
      <template v-else>
        <div class="flex flex-row items-center gap-6">
          <div
            class="w-20 h-20 rounded-xl shadow-lg flex items-center justify-center"
            :style="{ backgroundColor: props.primaryColor }"
          >
            <svg
              width="42"
              height="42"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              :style="{ marginTop: '36px' }"
            >
              <path d="m7.5 4.27 9 5.15" />
              <path
                d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
              />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          </div>

          <h1
            class="font-bold tracking-tight leading-none"
            :style="{ fontSize: `${titleFontSize}px` }"
          >
            {{ props.name }}
          </h1>
        </div>

        <!-- ./ and version on second row, under the icon -->
        <div class="flex flex-row items-baseline gap-6">
          <div
            class="w-20 text-right opacity-80"
            :style="{
              fontSize: `${versionFontSize}px`,
              color: props.primaryColor,
              paddingLeft: '22px',
            }"
          >
            ./
          </div>
          <span :style="{ fontSize: `${versionFontSize}px`, color: props.primaryColor }">
            v{{ truncatedVersion }}
          </span>
        </div>
      </template>

      <!-- Description (can extend under stats, will be faded out) -->
      <div v-if="props.description" class="text-4xl text-[#a3a3a3] max-w-[1000px]">
        {{ props.description }}
      </div>
    </div>

    <!-- Module format badges - top right (unchanged size) -->
    <div class="absolute top-8 right-10 flex flex-row items-center gap-2 text-xl">
      <span
        v-if="props.hasTypes"
        class="px-3 py-1 rounded-md bg-[#1a1a1a] border border-[#333] text-[#a3a3a3] font-medium"
      >
        Types
      </span>
      <span
        v-if="props.hasESM"
        class="px-3 py-1 rounded-md bg-[#1a1a1a] border border-[#333] text-[#a3a3a3] font-medium"
      >
        ESM
      </span>
      <span
        v-if="props.hasCJS"
        class="px-3 py-1 rounded-md bg-[#1a1a1a] border border-[#333] text-[#a3a3a3] font-medium"
      >
        CJS
      </span>
    </div>

    <!-- Gradient fade above stats -->
    <div
      class="absolute left-0 right-0 h-24 z-10"
      :style="{ bottom: '140px', background: 'linear-gradient(to bottom, transparent, #050505)' }"
    />

    <!-- Bottom stats (fixed at bottom) -->
    <div class="absolute bottom-14 left-16 right-16 z-20 flex flex-col gap-4 bg-[#050505]">
      <!-- GitHub stats row -->
      <div
        v-if="props.repoOwner && props.repoName"
        class="flex flex-row items-center gap-12 text-3xl text-[#737373]"
      >
        <span class="flex flex-row items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
            />
          </svg>
          {{ props.repoOwner }}/{{ props.repoName }}
        </span>
        <span v-if="props.stars" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
          {{ props.stars.toLocaleString() }}
        </span>
        <span v-if="props.forks" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
            <path d="M12 12v3" />
          </svg>
          {{ props.forks.toLocaleString() }}
        </span>
      </div>

      <!-- npm stats row -->
      <div class="flex flex-row items-center gap-12 text-3xl text-[#a3a3a3]">
        <span v-if="props.downloads" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          {{ props.downloads }}/wk
        </span>
        <span v-if="props.directDepsCount !== undefined" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            />
          </svg>
          {{ props.directDepsCount }} deps
        </span>
        <span v-if="props.license" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="M9 9h.01" />
            <path d="M15 15h.01" />
          </svg>
          {{ props.license }}
        </span>
        <span v-if="props.updatedAt" class="flex flex-row items-center gap-3">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          {{ props.updatedAt }}
        </span>
      </div>
    </div>

    <!-- Background glow -->
    <div
      class="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: props.primaryColor + '10' }"
    />
  </div>
</template>
