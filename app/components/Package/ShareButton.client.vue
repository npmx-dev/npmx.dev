<script setup lang="ts">
const props = defineProps<{
  packageName: string
  description?: string | null
}>()

const canShare = 'share' in navigator
const buttonRef = useTemplateRef<{ click: () => void }>('buttonRef')

if (canShare) {
  onKeyStroke(
    e => isKeyWithoutModifiers(e, 'v') && !isEditableElement(e.target),
    e => {
      e.preventDefault()
      // Click the button element so the browser anchors the share sheet at
      // the button's position rather than the current mouse cursor position.
      buttonRef.value?.click()
    },
  )
}

async function getOgImageFile(): Promise<File | null> {
  // Files sharing is not universally supported; bail out early if not available.
  if (!navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] })) {
    return null
  }
  try {
    const ogMeta = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
    if (!ogMeta?.content) return null
    const blob = await fetch(ogMeta.content).then(r => r.blob())
    if (!blob.type.startsWith('image/')) return null
    return new File([blob], `${props.packageName}.png`, { type: blob.type })
  } catch {
    return null
  }
}

const sharing = shallowRef(false)

async function share() {
  if (sharing.value) {
    return
  }
  sharing.value = true
  const shareData: ShareData = {
    title: props.packageName,
    text: props.description ?? props.packageName,
    url: window.location.href,
  }

  const imageFile = await getOgImageFile()
  if (imageFile) {
    const shareDataWithFile: ShareData = { ...shareData, files: [imageFile] }
    // Some implementations support sharing files or url/text, but not the
    // combination of both. Only attach the file once the full payload
    // (title + text + url + files) is confirmed shareable, so we keep the
    // url/text fallback otherwise.
    if (navigator.canShare?.(shareDataWithFile)) {
      shareData.files = shareDataWithFile.files
    }
  }

  await navigator
    .share(shareData)
    .catch(() => {})
    .finally(() => (sharing.value = false))
}

defineExpose({ sharePackage: share })
</script>

<template>
  <ButtonBase
    v-if="canShare"
    ref="buttonRef"
    variant="secondary"
    :classicon="sharing ? 'i-svg-spinners:ring-resize' : 'i-lucide:share-2'"
    :aria-label="$t('package.share_aria_label', { package: packageName })"
    :aria-keyshortcuts="'v'"
    @click="share"
  >
    <span class="max-sm:sr-only">{{ $t('package.links.share') }}</span>
  </ButtonBase>
</template>
