<script setup lang="ts">
const props = defineProps<{
  packageName: string
  resolvedVersion: string
  isLatest: boolean
  license?: string
}>()

const { origin } = useRequestURL()
const colorMode = useColorMode()
const theme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))
const { selectedAccentColor, accentColors } = useAccentColor()

function resolveColorToHex(color: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${r!.toString(16).padStart(2, '0')}${g!.toString(16).padStart(2, '0')}${b!.toString(16).padStart(2, '0')}`
}

const colorParam = computed(() => {
  const id = selectedAccentColor.value
  if (!id) return ''
  const colorValue = accentColors.value.find(c => c.id === id)?.value
  if (!colorValue) return ''
  const hex = resolveColorToHex(colorValue)
  return `&color=${encodeURIComponent(hex)}`
})

const cardUrl = computed(
  () => `/api/card/${props.packageName}.png?theme=${theme.value}${colorParam.value}`,
)
const absoluteCardUrl = computed(
  () => `${origin}/api/card/${props.packageName}.png?theme=${theme.value}${colorParam.value}`,
)

// Downloads for alt text
const { data: downloadsData } = usePackageDownloads(
  computed(() => props.packageName),
  'last-week',
)

const altText = computed(() => {
  const tag = props.isLatest ? 'latest' : props.resolvedVersion
  const parts: string[] = [`${props.packageName} ${props.resolvedVersion} (${tag})`]
  const dl = downloadsData.value?.downloads
  if (dl && dl > 0) {
    parts.push(
      `${Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(dl)} weekly downloads`,
    )
  }
  if (props.license) parts.push(`${props.license} license`)
  parts.push('via npmx.dev')
  return parts.join(' — ')
})

// Copy link button
const { copied: linkCopied, copy: copyLink } = useClipboard({
  source: absoluteCardUrl,
  copiedDuring: 1500,
})

// Copy alt text button
const { copied: altCopied, copy: copyAlt } = useClipboard({
  source: altText,
  copiedDuring: 1500,
})

// Reveal Copy ALT after the user has downloaded or copied the link
const showAlt = ref(false)

// Image load state
const imgLoaded = ref(false)
const imgError = ref(false)

watch(cardUrl, () => {
  imgLoaded.value = false
  imgError.value = false
})

async function downloadCard() {
  const a = document.createElement('a')
  a.href = cardUrl.value
  a.download = `${props.packageName.replace('/', '-')}-card.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  showAlt.value = true
}

function handleCopyLink() {
  copyLink(absoluteCardUrl.value)
  showAlt.value = true
}
</script>

<template>
  <Modal
    :modal-title="`share ${packageName}`"
    id="share-modal"
    class="sm:max-w-3xl"
    @close="showAlt = false"
  >
    <!--
      aspect-ratio matches card output (1280×520 = 2.46:1).
      The PNG is rendered at full 1280px, displayed inside a ~700px container —
      about 0.55× scale. image-rendering: high-quality ensures the browser
      uses a bicubic/lanczos algorithm instead of nearest-neighbour.
    -->
    <div
      class="bg-bg-elevated rounded-lg mb-4 overflow-hidden ring-1 ring-border"
      style="aspect-ratio: 1280/520"
    >
      <!-- Loading skeleton -->
      <div
        v-if="!imgLoaded && !imgError"
        class="w-full h-full flex flex-col items-center justify-center gap-2 text-fg-muted text-sm"
      >
        <span class="i-svg-spinners:ring-resize w-5 h-5" aria-hidden="true" />
        <span>Generating card…</span>
      </div>

      <!-- Error state -->
      <div
        v-else-if="imgError"
        class="w-full h-full flex items-center justify-center text-fg-muted text-sm"
      >
        Failed to load card.
      </div>

      <!-- Image — always rendered so fetch starts immediately on open -->
      <img
        :src="cardUrl"
        :alt="`${packageName} share card`"
        class="w-full h-full rounded"
        style="object-fit: contain; image-rendering: high-quality"
        :class="imgLoaded ? '' : 'hidden'"
        @load="imgLoaded = true"
        @error="imgError = true"
      />
    </div>

    <!-- Action row -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <ButtonBase
          :classicon="linkCopied ? 'i-lucide:check text-green-500' : 'i-lucide:link'"
          :disabled="!imgLoaded"
          @click="handleCopyLink"
        >
          {{ linkCopied ? 'Copied!' : 'Copy link' }}
        </ButtonBase>

        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-x-2 scale-95"
          enter-to-class="opacity-100 translate-x-0 scale-100"
        >
          <TooltipApp
            v-if="showAlt"
            :text="altCopied ? altText : 'Copy alt text for screen readers'"
            position="top"
            strategy="fixed"
          >
            <ButtonBase
              :classicon="altCopied ? 'i-lucide:check text-green-500' : 'i-lucide:copy'"
              :class="altCopied ? 'text-green-500' : ''"
              @click="copyAlt(altText)"
            >
              {{ altCopied ? 'Copied!' : 'Copy ALT' }}
            </ButtonBase>
          </TooltipApp>
        </Transition>
      </div>

      <ButtonBase variant="primary" classicon="i-lucide:download" :disabled="!imgLoaded" @click="downloadCard">
        Download PNG
      </ButtonBase>
    </div>
  </Modal>
</template>
