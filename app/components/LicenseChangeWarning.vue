<script setup lang="ts">
import type { LicenseChangeResponse } from '~/composables/useLicenseChanges'

const props = defineProps<{
  change: LicenseChangeResponse['change']
}>()
</script>

<template>
  <div
    v-if="props.change"
    class="border border-amber-600/40 bg-amber-500/10 rounded-lg mt-1 gap-x-1 py-2 px-3"
    :aria-label="$t('package.versions.license_change_help')"
  >
    <p class="text-md text-amber-800 dark:text-amber-400 flex items-center gap-2">
      <span
        class="i-lucide:alert-triangle w-4 h-4 flex-shrink-0"
        role="img"
        :aria-label="$t('package.versions.license_change_help')"
      />
      {{ $t('package.versions.license_change_warning') }}
    </p>
    <p class="text-md text-amber-800 dark:text-amber-400 mt-1">
      {{
        $t('package.versions.license_change_record', {
          from: props.change?.from,
          to: props.change?.to,
        })
      }}
    </p>
  </div>
</template>

<style scoped></style>
