<script setup lang="ts">
import type { InstallSizeDiff } from '~/composables/useInstallSizeDiff'

const props = defineProps<{
  diff: InstallSizeDiff
}>()

const bytesFormatter = useBytesFormatter()
const numberFormatter = useNumberFormatter()

const sizePercent = computed(() => Math.round(Math.abs(props.diff.sizeRatio) * 100))
const sizeDecreaseAbs = computed(() => Math.abs(props.diff.sizeIncrease))
const depDecreaseAbs = computed(() => Math.abs(props.diff.depDiff))
</script>

<template>
  <div
    class="border border-emerald-600/40 bg-emerald-500/10 rounded-lg px-3 py-2 text-base text-emerald-800 dark:text-emerald-400"
  >
    <h2 class="font-medium mb-1 flex items-center gap-2">
      <span class="i-lucide:trending-down w-4 h-4" aria-hidden="true" />
      <span>
        {{
          diff.sizeThresholdExceeded && diff.depThresholdExceeded
            ? $t('package.size_decrease.title_both', { version: diff.comparisonVersion })
            : diff.sizeThresholdExceeded
              ? $t('package.size_decrease.title_size', { version: diff.comparisonVersion })
              : $t('package.size_decrease.title_deps', { version: diff.comparisonVersion })
        }}
      </span>
      <span aria-hidden="true">🎉</span>
    </h2>
    <p class="text-sm m-0 mt-1">
      <i18n-t v-if="diff.sizeThresholdExceeded" keypath="package.size_decrease.size" scope="global">
        <template #percent
          ><strong>{{ sizePercent }}%</strong></template
        >
        <template #size
          ><strong>{{ bytesFormatter.format(sizeDecreaseAbs) }}</strong></template
        >
      </i18n-t>
      <template v-if="diff.sizeThresholdExceeded && diff.depThresholdExceeded"> · </template>
      <i18n-t v-if="diff.depThresholdExceeded" keypath="package.size_decrease.deps" scope="global">
        <template #count
          ><strong>−{{ numberFormatter.format(depDecreaseAbs) }}</strong></template
        >
      </i18n-t>
    </p>
  </div>
</template>
