<script setup lang="ts">
import { joinURL } from 'ufo'

const props = withDefaults(
  defineProps<{
    name: string
    version: string
    primaryColor?: string
  }>(),
  {
    primaryColor: '#60a5fa',
  },
)

const { name, version, primaryColor } = toRefs(props)

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

const { data: downloads, refresh: refreshDownloads } = usePackageDownloads(name, 'last-week')
const { data: pkg, refresh: refreshPkg } = usePackage(name, resolvedVersion.value ?? version.value)
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

const { data: likes, refresh: refreshLikes } = useFetch(() => `/api/social/likes/${name.value}`, {
  default: () => ({ totalLikes: 0, userHasLiked: false }),
})

const { stars, refresh: refreshRepoMeta } = useRepoMeta(repositoryUrl)

const formattedStars = computed(() =>
  Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(stars.value),
)

try {
  await refreshPkg()
  await Promise.all([refreshRepoMeta(), refreshDownloads(), refreshLikes()])
} catch (err) {
  console.warn('[og-image-package] Failed to load data server-side:', err)
  throw createError({
    statusCode: 404,
  })
}
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
  >
    <div class="relative z-10 flex flex-col gap-6">
      <div class="flex items-start gap-4">
        <div
          class="flex items-center justify-center w-16 h-16 p-4 rounded-xl shadow-lg bg-gradient-to-tr from-[#3b82f6]"
          :style="{ backgroundColor: primaryColor }"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
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
          class="text-8xl font-bold tracking-tighter"
          style="font-family: 'Geist Sans', sans-serif"
        >
          <span :style="{ color: primaryColor }" class="opacity-80">./</span>{{ pkg?.name }}
        </h1>
      </div>

      <div
        class="flex items-center gap-5 text-4xl font-light text-[#a3a3a3]"
        style="font-family: 'Geist Sans', sans-serif"
      >
        <span
          class="px-3 py-1 me-2 rounded-lg border font-bold opacity-90"
          :style="{
            color: primaryColor,
            backgroundColor: primaryColor + '10',
            borderColor: primaryColor + '30',
            boxShadow: `0 0 20px ${primaryColor}25`,
          }"
        >
          {{ resolvedVersion }}
        </span>
        <span v-if="downloads" class="flex items-center gap-2">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            :stroke="primaryColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="opacity-90"
          >
            <circle cx="12" cy="12" r="10" class="opacity-60" />
            <path d="M12 8v8m-3-3l3 3 3-3" />
          </svg>
          <span>{{ $n(downloads.downloads) }}/wk</span>
        </span>
        <span v-if="pkg?.license" class="flex items-center gap-2">
          <svg
            viewBox="0 0 32 32"
            :fill="primaryColor"
            xmlns="http://www.w3.org/2000/svg"
            height="32"
            width="32"
            class="opacity-90"
          >
            <path
              d="M21.7166 12.57C20.5503 10.631 18.4257 9.33301 15.9997 9.33301C12.3197 9.33301 9.33301 12.3197 9.33301 15.9997C9.33301 19.6797 12.3197 22.6663 15.9997 22.6663C18.4257 22.6663 20.5503 21.3683 21.7166 19.4294L19.4302 18.0586C18.7307 19.2218 17.4566 19.9997 15.9997 19.9997C13.7897 19.9997 11.9997 18.2097 11.9997 15.9997C11.9997 13.7897 13.7897 11.9997 15.9997 11.9997C17.457 11.9997 18.7318 12.7782 19.431 13.9421L21.7166 12.57Z"
            />
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M15.5247 2.66602C22.8847 2.66602 28.8581 8.63932 28.8581 15.9993C28.8581 23.3593 22.8847 29.3327 15.5247 29.3327C8.16471 29.3327 2.19141 23.3593 2.19141 15.9993C2.19141 8.63932 8.16471 2.66602 15.5247 2.66602ZM4.85807 15.9993C4.85807 10.106 9.63135 5.33268 15.5247 5.33268C21.4181 5.33268 26.1914 10.106 26.1914 15.9993C26.1914 21.8927 21.4181 26.666 15.5247 26.666C9.63135 26.666 4.85807 21.8927 4.85807 15.9993Z"
              class="opacity-60"
            />
          </svg>
          <span>
            {{ pkg.license }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            width="32px"
            height="32px"
            class="opacity-60"
          >
            <path
              :fill="primaryColor"
              d="m16 6.52l2.76 5.58l.46 1l1 .15l6.16.89l-4.38 4.3l-.75.73l.18 1l1.05 6.13l-5.51-2.89L16 23l-.93.49l-5.51 2.85l1-6.13l.18-1l-.74-.77l-4.42-4.35l6.16-.89l1-.15l.46-1zM16 2l-4.55 9.22l-10.17 1.47l7.36 7.18L6.9 30l9.1-4.78L25.1 30l-1.74-10.13l7.36-7.17l-10.17-1.48Z"
            />
          </svg>
          <span>
            {{ formattedStars }}
          </span>
        </span>
        <span class="flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            class="opacity-90"
          >
            <path
              d="M19.3057 25.8317L18.011 27.0837C17.7626 27.3691 17.4562 27.5983 17.1124 27.7561C16.7685 27.914 16.3951 27.9969 16.0167 27.9993C15.6384 28.0017 15.2639 27.9235 14.918 27.77C14.5722 27.6165 14.263 27.3912 14.011 27.1091L6.66699 19.9997C4.66699 17.9997 2.66699 15.7331 2.66699 12.6664C2.66702 11.1827 3.11712 9.73384 3.95784 8.51128C4.79856 7.28872 5.99035 6.34994 7.3758 5.81893C8.76126 5.28792 10.2752 5.18965 11.7177 5.53712C13.1602 5.88459 14.4633 6.66143 15.455 7.76506C15.5248 7.83975 15.6093 7.89929 15.7031 7.93999C15.7969 7.9807 15.8981 8.00171 16.0003 8.00171C16.1026 8.00171 16.2038 7.9807 16.2976 7.93999C16.3914 7.89929 16.4758 7.83975 16.5457 7.76506C17.5342 6.65426 18.8377 5.87088 20.2825 5.5192C21.7273 5.16751 23.245 5.26419 24.6335 5.79637C26.022 6.32856 27.2155 7.271 28.0551 8.49826C28.8948 9.72553 29.3407 11.1794 29.3337 12.6664C29.3332 13.3393 29.2349 14.0085 29.0417 14.6531"
              :stroke="primaryColor"
              stroke-width="2.66667"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="opacity-60"
            />
            <path
              d="M20 20H24M28 20H24M24 16L24 20M24 24L24 20"
              :stroke="primaryColor"
              stroke-width="2.66667"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>
            {{ likes.totalLikes }}
          </span>
        </span>
      </div>
    </div>

    <div
      class="absolute -top-32 -inset-ie-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
