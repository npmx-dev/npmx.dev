<script setup lang="ts">
import type { AsyncDataRequestStatus } from '#app'

defineOptions({
  inheritAttrs: false,
})

const { text, fetchMarkdown, markdown, status } = defineProps<{
  text: string
  fetchMarkdown: () => Promise<void>
  markdown: string | undefined
  status: AsyncDataRequestStatus
}>()

function prefetchMarkdown() {
  if (status === 'idle') {
    fetchMarkdown()
  }
}

const {
  copied: copiedReadme,
  copy,
  copyPending: copyReadmePending,
} = useClipboard({
  copiedDuring: 2000,
})

const { isPending: showError, start: startErrorTimer } = useTimeoutFn(() => {}, 3000, {
  immediate: false,
})

async function copyMarkdown() {
  copy(async () => {
    if (status !== 'success') {
      await fetchMarkdown()
    }
    if (status === 'error') {
      startErrorTimer()
      return ''
    }
    return markdown ?? ''
  })
}

const btn = useTemplateRef('btn')

const hover = useElementHover(() => btn.value?.$el, {
  // prevent fetching while moving the pointer
  delayEnter: 300,
})

const stopWatchHover = watch(hover, state => {
  if (state) {
    prefetchMarkdown()
    stopWatchHover()
  }
})

const icon = computed(() => {
  switch (true) {
    case showError.value:
      return 'i-lucide:x c-red size-4'
    case copiedReadme.value:
      return 'i-lucide:check'
  }
  return 'i-simple-icons:markdown'
})
</script>

<template>
  <TooltipAnnounce :is-visible="showError" :text="$t('common.copyMdError')">
    <TooltipApp :text position="bottom">
      <ButtonBase
        ref="btn"
        @focus="prefetchMarkdown"
        @click="copyMarkdown"
        :aria-pressed="copiedReadme"
        :aria-label="copiedReadme && !showError ? $t('common.copied') : text"
        :classicon="icon"
        v-bind="$attrs"
      >
        <span>{{ copiedReadme && !showError ? $t('common.copied') : $t('common.copy') }}</span>
        <span v-if="copyReadmePending" class="i-lucide:loader-circle animate-spin size-4"></span>
      </ButtonBase>
    </TooltipApp>
  </TooltipAnnounce>
</template>
