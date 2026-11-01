<script setup lang="ts">
import type { SlimPackumentVersion } from '#shared/types'
import { downloadPackageTarball } from '~/utils/package-download'

const props = defineProps<{
  packageName: string
  version: SlimPackumentVersion
  iconOnly?: boolean
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
      v-if="iconOnly"
      ref="triggerRef"
      v-bind="$attrs"
      type="button"
      @click="downloadPackage"
      :disabled="loading"
      :aria-label="$t('package.download.button')"
      :classicon="loading ? 'i-lucide:loader-circle animate-spin' : 'i-lucide:download'"
      class="border-border-subtle bg-bg-subtle! text-fg-muted hover:enabled:(text-fg border-border-hover)"
    />
    <ButtonBase
      v-else
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
