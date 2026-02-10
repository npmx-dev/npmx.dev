<script setup lang="ts">
import type { BuildInfo } from '#shared/types'

const { footer = false, buildInfo: buildInfoProp } = defineProps<{
  footer?: boolean
  buildInfo?: BuildInfo
}>()

const appConfig = useAppConfig()
const buildInfo = computed(() => buildInfoProp || appConfig.buildInfo)
const buildTime = computed(() => new Date(buildInfo.value.time))
</script>

<template>
  <div
    class="font-mono text-xs text-fg-muted flex items-center gap-2 motion-safe:animate-fade-in motion-safe:animate-fill-both"
    :class="footer ? 'my-1 justify-center sm:justify-start' : 'mb-8 justify-center'"
    style="animation-delay: 0.05s"
  >
    <i18n-t keypath="built_at" scope="global">
      <DateTime :datetime="buildTime" year="numeric" month="short" day="numeric" />
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
