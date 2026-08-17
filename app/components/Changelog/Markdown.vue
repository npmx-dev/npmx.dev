<script setup lang="ts">
const { info, goToVersion, tpTarget, resolveVersionPending } = defineProps<{
  info: ChangelogMarkdownInfo
  goToVersion: string | null | undefined
  tpTarget?: HTMLElement | null
  resolveVersionPending?: boolean
}>()

const route = useRoute()

const url = computed(() => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}` as const)
const host = computed(() => info.host)

const { data, error, pending } = useLazyFetch(url, {
  query: {
    host,
  },
})

if (import.meta.client) {
  const { settings } = useSettings()

  // doing this server side can make it that we go to the homepage
  const stopWatching = watchEffect(
    () => {
      if (resolveVersionPending || typeof data.value == 'string') {
        return // need to wait till resolving is finished
      }
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
      const isMatching = createHeadingVersionMatcher(lcRequestedVersion)

      for (const item of toc) {
        const text = item.text.toLowerCase()
        if (text.toLowerCase().includes(lcRequestedVersion) && isMatching(text)) {
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

// fetch raw markdown to copy
const {
  data: rawMarkdown,
  execute: fetchMarkdown,
  status: mdStatus,
} = useLazyFetch<string>(url, {
  query: {
    host,
    raw: true,
  },
  immediate: false,
  server: false,
})
</script>

<template>
  <ChangelogSkeleton v-if="pending" />
  <template v-else-if="typeof data == 'object' && data?.html">
    <Teleport v-if="data.html && !!tpTarget" :to="tpTarget">
      <ButtonCopyMd
        v-if="data?.toc && data.toc.length > 1"
        :fetchMarkdown
        :markdown="rawMarkdown"
        :status="mdStatus"
        :text="$t('changelog.copy_as_markdown')"
      />
      <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
    </Teleport>
    <Readme :html="data.html" class="pt-4"></Readme>
  </template>
  <slot v-else-if="error" name="error"></slot>
</template>
