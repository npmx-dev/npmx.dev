<script setup lang="ts">
import { slugify } from '~~/shared/utils/html'

const { info, requestedDate, requestedVersion } = defineProps<{
  info: ChangelogReleaseInfo
  requestedDate?: string
  requestedVersion?: string | null | undefined
}>()

const { data: releases } = useFetch<ReleaseData[]>(
  () => `/api/changelog/releases/${info.provider}/${info.repo}`,
)

const route = useRoute()

const matchingDateReleases = computed(() => {
  if (!requestedDate || !releases.value) {
    return
  }

  return releases.value.filter(release => {
    if (!release.publishedAt) {
      return
    }
    const date = new Date(release.publishedAt).toISOString().split('T')[0]

    return date == requestedDate
  })
})

watch(
  [() => route.hash, () => requestedDate?.toLowerCase(), releases, () => requestedVersion],
  ([hash, date, r, rv]) => {
    if (hash && r) {
      // ensures the user is scrolled to the hash
      navigateTo(hash)
      return
    }
    if (hash || !date || !r) {
      return
    }
    if (rv) {
      for (const match of matchingDateReleases.value ?? []) {
        if (match.title.toLowerCase().includes(rv)) {
          navigateTo(`#release-${slugify(match.title)}`)
          return
        }
      }
    }

    navigateTo(`#date-${date}`)
  },
  {
    immediate: true,
  },
)
</script>
<template>
  <div class="flex flex-col gap-2 py-3" v-if="releases">
    <ClientOnly>
      <ChangelogCard v-for="release of releases" :release :key="release.id" />
    </ClientOnly>
  </div>
</template>
