<script setup lang="ts">
const props = defineProps<{
  packageName: string
  description?: string | null
}>()

const canShare = 'share' in navigator
const buttonRef = useTemplateRef<{ click: () => void }>('buttonRef')
const keyboardShortcutsEnabled = useKeyboardShortcuts()

if (canShare) {
  onKeyStroke(
    e =>
      keyboardShortcutsEnabled.value &&
      isKeyWithoutModifiers(e, 'v') &&
      !isEditableElement(e.target),
    e => {
      e.preventDefault()
      // Click the button element so the browser anchors the share sheet at
      // the button's position rather than the current mouse cursor position.
      buttonRef.value?.click()
    },
  )
}

async function fetchOgImageFile(url: string): Promise<File | null> {
  // Files sharing is not universally supported; bail out early if not available.
  if (!navigator.canShare?.({ files: [new File([], 'x.png', { type: 'image/png' })] })) {
    return null
  }
  try {
    const blob = await fetch(url).then(r => r.blob())
    if (!blob.type.startsWith('image/')) return null
    return new File([blob], `${props.packageName}.png`, { type: blob.type })
  } catch {
    return null
  }
}

let ogImage: { url: string; file: Promise<File | null> } | undefined

// Fetch the og:image ahead of the click: `navigator.share()` needs transient
// user activation, which a slow network request in the click handler can use up.
// Keyed by URL, since the meta tag changes on client-side navigation.
function getOgImageFile(): Promise<File | null> {
  const url = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content
  if (!url) return Promise.resolve(null)
  if (ogImage?.url !== url) {
    ogImage = { url, file: fetchOgImageFile(url) }
  }
  return ogImage.file
}

if (canShare) {
  onMounted(getOgImageFile)
}

async function share() {
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

  // Firefox on Android may never settle this promise, so keep no state that
  // depends on it. A second call while the share sheet is open rejects.
  await navigator.share(shareData).catch(() => {})
}

defineExpose({ sharePackage: share })
</script>

<template>
  <ButtonBase
    v-if="canShare"
    ref="buttonRef"
    variant="secondary"
    classicon="i-lucide:share-2"
    :aria-label="$t('package.share_aria_label', { package: packageName })"
    :ariaKeyshortcuts="keyboardShortcutsEnabled ? 'v' : undefined"
    @click="share"
    @pointerenter="getOgImageFile"
    @focus="getOgImageFile"
  >
    <span class="max-sm:sr-only">{{ $t('package.links.share') }}</span>
  </ButtonBase>
</template>
