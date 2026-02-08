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
    <LinkBase
      v-if="buildInfo.env === 'release'"
      :to="`https://github.com/npmx-dev/npmx.dev/tag/v${buildInfo.version}`"
    >
      v{{ buildInfo.version }}
    </LinkBase>
    <span v-else class="tracking-wider">{{ buildInfo.env }}</span>

    <template v-if="buildInfo.commit && buildInfo.branch !== 'release'">
      <span>&middot;</span>
      <LinkBase :to="`https://github.com/npmx-dev/npmx.dev/commit/${buildInfo.commit}`">
        {{ buildInfo.shortCommit }}
      </LinkBase>
    </template>
  </div>
</template>
