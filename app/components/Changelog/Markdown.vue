<script setup lang="ts">
const { info, requestedVersion, tpTarget } = defineProps<{
  info: ChangelogMarkdownInfo
  requestedVersion: string | null | undefined
  tpTarget?: HTMLElement | null
}>()

const route = useRoute()

const { data, error } = await useFetch(
  () => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}`,
)

if (import.meta.client) {
  watch(
    [() => data.value?.toc, () => requestedVersion?.toLowerCase(), () => route.hash],
    ([toc, rv, hash]) => {
      if (toc && hash) {
        navigateTo(hash)
        return
      }

      if (!toc || !rv || hash) {
        return
      }

      for (const item of toc) {
        if (item.text.toLowerCase().includes(rv)) {
          navigateTo(`#${item.id}`)
          return
        }
      }
    },
    {
      immediate: true,
    },
  )
}
</script>
<template>
  <Teleport v-if="data?.toc && data.toc.length > 1 && !!tpTarget" :to="tpTarget">
    <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
  </Teleport>
  <Readme v-if="data?.html" :html="data.html"></Readme>
  <slot v-else-if="error" name="error"></slot>
</template>
