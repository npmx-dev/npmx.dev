<script setup lang="ts">
import { slugify } from '~~/shared/utils/html'

const { info, requestedDate, goToVersion, resolveVersionPending } = defineProps<{
  info: ChangelogReleaseInfo
  requestedDate?: string
  goToVersion?: string | null | undefined
  resolveVersionPending?: boolean
}>()

const {
  data: releases,
  error,
  pending,
} = useLazyFetch<ReleaseData[]>(() => `/api/changelog/releases/${info.provider}/${info.repo}`)

const route = useRoute()

const matchingDateReleases = computed(() => {
  if (!requestedDate || !releases.value) {
    return []
  }

  return releases.value.filter(release => {
    if (!release.publishedAt) {
      return
    }
    return requestedDate === release.publishedAt.slice(0, 10)
  })
})

if (import.meta.client) {
  const { settings } = useSettings()

  // doing this server side can make it that we go to the homepage
  const stopWatching = watchEffect(
    () => {
      if (resolveVersionPending) {
        return // need to wait till resolving is finished
      }
      const uReleases = releases.value
      if (route.hash && uReleases) {
        // scroll if there is a hash in the url
        navigateTo(route.hash, { replace: true })
        return
      }
      // don't allow auto scrolling when disabled and there was no hash before
      if (!settings.value.changelogAutoScroll) {
        return
      }
      const date = requestedDate?.toLowerCase()
      if (route.hash || !date || !uReleases || !goToVersion) {
        return
      }
      const uMatchingDateReleases = matchingDateReleases.value
      if (uMatchingDateReleases?.length < 1) {
        // if no releases have matched the requested version publish date then most likely no release note has been made
        return
      }

      if (goToVersion) {
        for (const match of uMatchingDateReleases) {
          if (match.title.toLowerCase().includes(goToVersion)) {
            navigateTo(`#release-${slugify(match.title)}`, { replace: true })
            return
          }
        }
      }
      navigateTo(`#date-${date}`, { replace: true })
    },
    { flush: 'post' },
  )
  // stops watchEffect from trigger just before navigating
  onBeforeRouteLeave(stopWatching)
}

prefetchComponents('ChangelogCard')
</script>
<template>
  <ChangelogSkeleton v-if="pending" />
  <div class="flex flex-col gap-2 py-3" v-else-if="releases">
    <ChangelogCard v-for="release of releases" :release :key="release.id" />
  </div>
  <slot v-else-if="error" name="error"></slot>
</template>
