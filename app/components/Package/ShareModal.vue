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
const { selectedAccentColor } = useAccentColor()
const colorParam = computed(() => selectedAccentColor.value ? `&color=${selectedAccentColor.value}` : '')

const cardUrl = computed(() => `/api/card/${props.packageName}.png?theme=${theme.value}${colorParam.value}`)
const absoluteCardUrl = computed(() => `${origin}/api/card/${props.packageName}.png?theme=${theme.value}${colorParam.value}`)

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

// Image load state — dialog is display:none when closed so loading begins on open
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
}
</script>

<template>
  <Modal
    :modal-title="`share ${packageName}`"
    id="share-modal"
    class="sm:max-w-3xl"
  >
    <!-- Card preview -->
    <div class="bg-bg-elevated rounded-lg mb-4 overflow-hidden" style="aspect-ratio: 1200/420">
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

      <!-- The image itself — always rendered so the browser starts fetching on open -->
      <img
        :src="cardUrl"
        :alt="`${packageName} share card`"
        class="w-full h-full object-cover rounded"
        :class="imgLoaded ? '' : 'hidden'"
        @load="imgLoaded = true"
        @error="imgError = true"
      />
    </div>

    <!-- Action row -->
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Download PNG — primary -->
      <ButtonBase variant="primary" classicon="i-lucide:download" @click="downloadCard">
        Download PNG
      </ButtonBase>

      <!-- Copy link -->
      <ButtonBase
        :classicon="linkCopied ? 'i-lucide:check text-green-500' : 'i-lucide:link'"
        @click="copyLink(absoluteCardUrl)"
      >
        {{ linkCopied ? 'Copied!' : 'Copy link' }}
      </ButtonBase>

      <!-- ALT: copy image alt text, tooltip shows the full string on hover -->
      <TooltipApp :text="altCopied ? altText : 'Copy alt text for screen readers'" position="top" strategy="fixed">
        <ButtonBase
          :classicon="altCopied ? 'i-lucide:check text-green-500' : 'i-lucide:accessibility'"
          :class="altCopied ? 'text-green-500' : ''"
          @click="copyAlt(altText)"
        >
          {{ altCopied ? 'Copied!' : 'Copy ALT' }}
        </ButtonBase>
      </TooltipApp>
    </div>

    <!-- README snippet hint -->
    <p class="text-xs text-fg-subtle mt-3 font-mono">
      Paste the link into any markdown file — GitHub renders it automatically.
    </p>
  </Modal>
</template>
