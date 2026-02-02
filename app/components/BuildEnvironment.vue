<script setup lang="ts">
defineProps<{
  footer?: boolean
}>()

const { locale } = useI18n()
const buildInfo = useAppConfig().buildInfo
</script>

<template>
  <div
    class="font-mono text-xs text-fg-muted flex items-center gap-2 motion-safe:animate-fade-in motion-safe:animate-fill-both"
    :class="footer ? 'mt-4 justify-start' : 'mb-8 justify-center'"
    style="animation-delay: 0.05s"
  >
    <i18n-t keypath="built_at" scope="global">
      <NuxtTime :datetime="buildInfo.time" :locale="locale" relative />
    </i18n-t>
    <span>&middot;</span>
    <NuxtLink
      v-if="buildInfo.env === 'release'"
      external
      :href="`https://github.com/npmx-dev/npmx.dev/tag/v${buildInfo.version}`"
      target="_blank"
      class="hover:text-fg transition-colors"
    >
      v{{ buildInfo.version }}
    </NuxtLink>
    <span v-else class="tracking-wider">{{ buildInfo.env }}</span>

    <template v-if="buildInfo.commit && buildInfo.branch !== 'release'">
      <span>&middot;</span>
      <NuxtLink
        external
        :href="`https://github.com/npmx-dev/npmx.dev/commit/${buildInfo.commit}`"
        target="_blank"
        class="hover:text-fg transition-colors"
      >
        {{ buildInfo.shortCommit }}
      </NuxtLink>
    </template>
  </div>
</template>
