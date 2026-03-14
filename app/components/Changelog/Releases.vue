<script setup lang="ts">
import { slugify } from '~~/shared/utils/html'

const { info, requestedDate, requestedVersion, tocHeaderClass } = defineProps<{
  info: ChangelogReleaseInfo
  requestedDate?: string
  requestedVersion?: string | null | undefined
  tocHeaderClass: string
}>()

const { data: releases, error } = await useFetch<ReleaseData[]>(
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

if (import.meta.client) {
  watch(
    [() => route.hash, () => requestedDate?.toLowerCase(), releases, () => requestedVersion],
    ([hash, date, r, rv]) => {
      if (hash && r) {
        // ensures the user is scrolled to the hash
        navigateTo(hash, { replace: true })
        return
      }
      if (hash || !date || !r) {
        return
      }
      if (rv) {
        for (const match of matchingDateReleases.value ?? []) {
          if (match.title.toLowerCase().includes(rv)) {
            navigateTo(`#release-${slugify(match.title)}`, { replace: true })
            return
          }
        }
      }

      navigateTo(`#date-${date}`, { replace: true })
    },
    {
      immediate: true,
      flush: 'post',
    },
  )
}
</script>
<template>
  <div class="flex flex-col gap-2 py-3" v-if="releases">
    <ChangelogCard v-for="release of releases" :release :key="release.id" :tocHeaderClass />
  </div>
  <slot v-else-if="error" name="error"></slot>
</template>
