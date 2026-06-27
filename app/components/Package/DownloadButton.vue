<script setup lang="ts">
import type { SlimPackumentVersion } from '#shared/types'
import { downloadPackageTarball } from '~/utils/package-download'

const props = defineProps<{
  packageName: string
  version: SlimPackumentVersion
}>()

const loading = shallowRef(false)

async function downloadPackage() {
  if (loading.value) return
  loading.value = true

  try {
    await downloadPackageTarball(props.packageName, props.version)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <TooltipApp :text="$t('package.download.tarball')">
    <ButtonBase
      ref="triggerRef"
      v-bind="$attrs"
      type="button"
      @click="downloadPackage"
      :disabled="loading"
      class="border-border-subtle bg-bg-subtle! text-xs text-fg-muted hover:enabled:(text-fg border-border-hover)"
    >
      <span
        class="size-[1em]"
        aria-hidden="true"
        :class="loading ? 'i-lucide:loader-circle animate-spin' : 'i-lucide:download'"
      />
      {{ $t('package.download.button') }}
    </ButtonBase>
  </TooltipApp>
</template>
