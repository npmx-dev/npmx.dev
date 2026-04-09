<script setup lang="ts">
import { useLicenseChanges } from '~/composables/useLicenseChanges'

const props = defineProps<{
  license?: string
  packageName?: string
  resolvedVersion: string | null | undefined
}>()

const { data: licenseData } = useLicenseChanges(
  () => props.packageName,
  () => props.resolvedVersion,
)
const licenseChangeRecord = computed(() => licenseData?.value?.change ?? null)
</script>

<template>
  <div
    v-if="licenseChangeRecord"
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
          from: licenseChangeRecord?.from,
          to: licenseChangeRecord?.to,
        })
      }}
    </p>
  </div>
</template>

<style scoped></style>
