<script setup lang="ts">
import type { InstallSizeDiff } from '~/composables/useInstallSizeDiff'

const props = defineProps<{
  diff: InstallSizeDiff
}>()

const bytesFormatter = useBytesFormatter()
const numberFormatter = useNumberFormatter()

const sizePercent = computed(() => Math.round(props.diff.sizeRatio * 100))
</script>

<template>
  <div
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg px-3 py-2 text-base text-amber-800 dark:text-amber-400"
  >
    <h2 class="font-medium mb-1 flex items-center gap-2">
      <span class="i-lucide:trending-up w-4 h-4" aria-hidden="true" />
      {{
        diff.sizeThresholdExceeded && diff.depThresholdExceeded
          ? $t('package.size_increase.title_both', { version: diff.comparisonVersion })
          : diff.sizeThresholdExceeded
            ? $t('package.size_increase.title_size', { version: diff.comparisonVersion })
            : $t('package.size_increase.title_deps', { version: diff.comparisonVersion })
      }}
    </h2>
    <p class="text-sm m-0 mt-1">
      <i18n-t v-if="diff.sizeThresholdExceeded" keypath="package.size_increase.size" scope="global">
        <template #percent
          ><strong>{{ sizePercent }}%</strong></template
        >
        <template #size
          ><strong>{{ bytesFormatter.format(diff.sizeIncrease) }}</strong></template
        >
      </i18n-t>
      <template v-if="diff.sizeThresholdExceeded && diff.depThresholdExceeded"> · </template>
      <i18n-t v-if="diff.depThresholdExceeded" keypath="package.size_increase.deps" scope="global">
        <template #count
          ><strong>+{{ numberFormatter.format(diff.depDiff) }}</strong></template
        >
      </i18n-t>
    </p>
  </div>
</template>
