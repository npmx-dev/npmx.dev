<script setup lang="ts">
import type { SlimPackumentVersion } from '#shared/types'

const props = defineProps<{
  packageName: string
  version: SlimPackumentVersion
}>()

const loading = shallowRef(false)

async function getDownloadUrl(tarballUrl: string) {
  try {
    const response = await fetch(tarballUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch tarball (${response.status})`)
    }
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  } catch (error) {
    // oxlint-disable-next-line no-console -- error logging
    console.error('failed to fetch tarball', { cause: error })
    return null
  }
}

async function downloadPackage() {
  const tarballUrl = props.version.dist.tarball
  if (!tarballUrl) return

  if (loading.value) return
  loading.value = true

  const downloadUrl = await getDownloadUrl(tarballUrl)

  const link = document.createElement('a')
  link.href = downloadUrl ?? tarballUrl
  link.download = `${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl)
  }

  loading.value = false
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
