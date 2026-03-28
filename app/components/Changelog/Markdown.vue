<script setup lang="ts">
const { info, goToVersion, tpTarget } = defineProps<{
  info: ChangelogMarkdownInfo
  goToVersion: string | null | undefined
  tpTarget?: HTMLElement | null
}>()

const route = useRoute()

const { data, error } = await useLazyFetch(
  () => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}`,
)

if (import.meta.client) {
  const { settings } = useSettings()

  // doing this server side can make it that we go to the homepage
  const stopWatching = watchEffect(
    () => {
      const toc = data.value?.toc

      if (toc && route.hash) {
        // scroll if there is a hash in the url
        return navigateTo(route.hash)
      }

      // don't allow auto scrolling when disabled and there was no hash before
      if (!settings.value.changelogAutoScroll || !toc || !goToVersion || route.hash) {
        return
      }
      // lc = lower case
      const lcRequestedVersion = goToVersion.toLowerCase()
      for (const item of toc) {
        if (item.text.toLowerCase().includes(lcRequestedVersion)) {
          navigateTo(`#${item.id}`)
          return
        }
      }
    },
    { flush: 'post' },
  )

  // stops watchEffect from trigger just before navigating
  onBeforeRouteLeave(stopWatching)
}
</script>
<template>
  <Teleport v-if="data?.toc && data.toc.length > 1 && !!tpTarget" :to="tpTarget">
    <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
  </Teleport>
  <Readme v-if="data?.html" :html="data.html" class="pt-4"></Readme>
  <slot v-else-if="error" name="error"></slot>
</template>
