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

const colorParam = computed(() =>
  selectedAccentColor.value ? `&color=${encodeURIComponent(selectedAccentColor.value)}` : '',
)

const cardUrl = computed(
  () => `/api/card/${props.packageName}.png?theme=${theme.value}${colorParam.value}`,
)
const absoluteCardUrl = computed(() => `${origin}${cardUrl.value}`)

// Downloads for alt text
const compactFormatter = useCompactNumberFormatter()
const { data: downloadsData } = usePackageDownloads(
  computed(() => props.packageName),
  'last-week',
)

// e.g. nuxt 4.4.2 (latest) — 1.4M weekly downloads — MIT license — via npmx.dev
const altText = computed(() => {
  const tag = props.isLatest ? 'latest' : props.resolvedVersion
  const parts: string[] = [`${props.packageName} ${props.resolvedVersion} (${tag})`]
  const dl = downloadsData.value?.downloads
  if (dl && dl > 0) {
    parts.push(`${compactFormatter.value.format(dl)} weekly downloads`)
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
  showAlt.value = false
})

async function downloadCard() {
  const a = document.createElement('a')
  a.href = cardUrl.value
  a.download = `${props.packageName.replace('/', '-')}-card.png`
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    document.body.removeChild(a)
  }
  showAlt.value = true
}

function handleCopyLink() {
  copyLink()
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
    <div
      class="bg-bg-elevated rounded-lg mb-4 overflow-hidden ring-1 ring-border-subtle"
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
        :class="{ hidden: !imgLoaded }"
        @load="imgLoaded = true"
        @error="imgError = true"
      />
    </div>

    <!-- Action row -->
    <div class="flex items-center gap-2">
      <Transition
        enter-active-class="transition-all duration-150"
        leave-active-class="transition-all duration-100"
        enter-from-class="opacity-0 translate-y-1"
        leave-to-class="opacity-0 translate-y-1"
      >
        <TooltipApp
          v-if="showAlt"
          :text="altCopied ? altText : 'Copy alt text for screen readers'"
          position="top"
          strategy="fixed"
        >
          <ButtonBase
            :classicon="altCopied ? 'i-lucide:check' : 'i-lucide:copy'"
            @click="copyAlt()"
          >
            {{ altCopied ? 'Copied!' : 'Copy ALT' }}
          </ButtonBase>
        </TooltipApp>
      </Transition>

      <div class="flex items-center gap-2 ms-auto">
        <ButtonBase
          :classicon="linkCopied ? 'i-lucide:check' : 'i-lucide:link'"
          :disabled="!imgLoaded"
          @click="handleCopyLink"
        >
          {{ linkCopied ? 'Copied!' : 'Copy link' }}
        </ButtonBase>

        <ButtonBase
          variant="primary"
          classicon="i-lucide:download"
          :disabled="!imgLoaded"
          @click="downloadCard"
        >
          Download PNG
        </ButtonBase>
      </div>
    </div>
  </Modal>
</template>
