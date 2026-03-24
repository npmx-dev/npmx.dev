<script setup lang="ts">
import { ACCENT_COLORS, type AccentColorId } from '#shared/utils/constants'

const { selectedAccentColor } = useAccentColor()
const { t } = useI18n()

const customAccent = ref<string | null>(null)
const customBgDark = ref(true)
const customLogoRef = useTemplateRef('customLogoRef')

const activeAccentId = computed(() => customAccent.value ?? selectedAccentColor.value ?? 'sky')

// Use the palette matching the preview background, not the site theme
const previewPalette = computed(() =>
  customBgDark.value ? ACCENT_COLORS.dark : ACCENT_COLORS.light,
)

const activeAccentColor = computed(() => {
  return previewPalette.value[activeAccentId.value as AccentColorId] ?? previewPalette.value.sky
})

const accentColorLabels = computed<Record<AccentColorId, string>>(() => ({
  sky: t('settings.accent_colors.sky'),
  coral: t('settings.accent_colors.coral'),
  amber: t('settings.accent_colors.amber'),
  emerald: t('settings.accent_colors.emerald'),
  violet: t('settings.accent_colors.violet'),
  magenta: t('settings.accent_colors.magenta'),
  neutral: t('settings.clear_accent'),
}))

// Color swatches match the preview background palette so the circles reflect what the logo will render
const pickerColors = computed(() =>
  Object.entries(previewPalette.value).map(([id, value]) => ({
    id: id as AccentColorId,
    label: accentColorLabels.value[id as AccentColorId],
    value,
  })),
)

function getCustomSvgString(): string {
  const el = customLogoRef.value?.$el as SVGElement | undefined
  if (!el) return ''
  const clone = el.cloneNode(true) as SVGElement
  clone.querySelectorAll<SVGElement>('[fill="currentColor"]').forEach(path => {
    path.setAttribute('fill', customBgDark.value ? '#fafafa' : '#0a0a0a')
  })
  clone.querySelectorAll<SVGElement>('[fill="var(--accent)"]').forEach(path => {
    const style = getComputedStyle(path as SVGElement)
    path.setAttribute('fill', style.fill || activeAccentColor.value)
  })
  clone.removeAttribute('aria-hidden')
  clone.removeAttribute('class')
  return new XMLSerializer().serializeToString(clone)
}

const svgLoading = ref(false)

function downloadCustomSvg() {
  const svg = getCustomSvgString()
  if (!svg) return
  svgLoading.value = true
  try {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    downloadFile(blob, `npmx-logo-${activeAccentId.value}.svg`)
  } finally {
    svgLoading.value = false
  }
}

const pngLoading = ref(false)

async function downloadCustomPng() {
  const svg = getCustomSvgString()
  if (!svg) return
  pngLoading.value = true

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  try {
    await document.fonts.ready

    const img = new Image()
    const loaded = new Promise<void>((resolve, reject) => {
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      img.onload = () => resolve()
      // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
      img.onerror = () => reject(new Error('Failed to load custom SVG'))
    })
    img.src = url
    await loaded

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = 602 * scale
    canvas.height = 170 * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = customBgDark.value ? '#0a0a0a' : '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, 602, 170)

    await new Promise<void>(resolve => {
      canvas.toBlob(pngBlob => {
        if (pngBlob) downloadFile(pngBlob, `npmx-logo-${activeAccentId.value}.png`)
        resolve()
      }, 'image/png')
    })
  } finally {
    URL.revokeObjectURL(url)
    pngLoading.value = false
  }
}
</script>

<template>
  <section aria-labelledby="brand-customize-heading">
    <h2 id="brand-customize-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
      {{ $t('brand.customize.title') }}
    </h2>
    <p class="text-fg-muted leading-relaxed mb-8">
      {{ $t('brand.customize.description') }}
    </p>

    <div class="border border-border rounded-lg overflow-hidden">
      <!-- Live preview -->
      <div
        class="flex items-center justify-center p-10 sm:p-16 transition-colors duration-300 motion-reduce:transition-none"
        :class="customBgDark ? 'bg-[#0a0a0a]' : 'bg-white'"
      >
        <AppLogo
          ref="customLogoRef"
          class="h-10 sm:h-14 w-auto max-w-full transition-colors duration-300 motion-reduce:transition-none"
          :class="customBgDark ? 'text-[#fafafa]' : 'text-[#0a0a0a]'"
          :style="{ '--accent': activeAccentColor }"
        />
      </div>

      <!-- Controls -->
      <div class="border-t border-border p-4 sm:p-6 flex flex-col gap-4">
        <!-- Row 1: Accent color picker -->
        <fieldset class="flex items-center gap-3 border-none p-0 m-0">
          <legend class="sr-only">{{ $t('brand.customize.accent_label') }}</legend>
          <span class="text-sm font-mono text-fg-muted shrink-0">{{
            $t('brand.customize.accent_label')
          }}</span>
          <div class="flex items-center gap-1.5" role="radiogroup">
            <ButtonBase
              v-for="color in pickerColors"
              :key="color.id"
              role="radio"
              :aria-checked="activeAccentId === color.id"
              :aria-label="color.label"
              class="!w-6 !h-6 !rounded-full !border-2 !p-0 !min-w-0 transition-all duration-150 motion-reduce:transition-none"
              :class="
                activeAccentId === color.id
                  ? '!border-fg scale-110'
                  : color.id === 'neutral'
                    ? '!border-border hover:!border-border-hover'
                    : '!border-transparent hover:!border-border-hover'
              "
              :style="{ backgroundColor: color.value }"
              @click="customAccent = color.id"
            />
          </div>
        </fieldset>

        <!-- Row 2: Background toggle + Download buttons -->
        <div class="flex items-center gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <span class="text-sm font-mono text-fg-muted">{{ $t('brand.customize.bg_label') }}</span>
            <div
              class="flex items-center border border-border rounded-md overflow-hidden"
              role="radiogroup"
            >
              <ButtonBase
                size="md"
                role="radio"
                :aria-checked="customBgDark"
                :aria-label="$t('brand.logos.on_dark')"
                class="!border-none !rounded-none motion-reduce:transition-none"
                :class="
                  customBgDark ? 'bg-bg-muted text-fg' : 'bg-transparent text-fg-muted hover:text-fg'
                "
                @click="customBgDark = true"
              >
                {{ $t('brand.logos.on_dark') }}
              </ButtonBase>
              <ButtonBase
                size="md"
                role="radio"
                :aria-checked="!customBgDark"
                :aria-label="$t('brand.logos.on_light')"
                class="!border-none !rounded-none border-is border-is-border motion-reduce:transition-none"
                :class="
                  !customBgDark ? 'bg-bg-muted text-fg' : 'bg-transparent text-fg-muted hover:text-fg'
                "
                @click="customBgDark = false"
              >
                {{ $t('brand.logos.on_light') }}
              </ButtonBase>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <ButtonBase
              size="md"
              :aria-label="$t('brand.customize.download_svg_aria')"
              :disabled="svgLoading"
              @click="downloadCustomSvg"
            >
              <span
                class="size-[1em]"
                aria-hidden="true"
                :class="svgLoading ? 'i-lucide:loader-circle animate-spin' : 'i-lucide:download'"
              />
              {{ $t('brand.logos.download_svg') }}
            </ButtonBase>
            <ButtonBase
              size="md"
              :aria-label="$t('brand.customize.download_png_aria')"
              :disabled="pngLoading"
              @click="downloadCustomPng"
            >
              <span
                class="size-[1em]"
                aria-hidden="true"
                :class="pngLoading ? 'i-lucide:loader-circle animate-spin' : 'i-lucide:download'"
              />
              {{ $t('brand.logos.download_png') }}
            </ButtonBase>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
