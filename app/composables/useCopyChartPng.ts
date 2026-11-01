import { shallowRef, nextTick, toValue, type MaybeRefOrGetter } from 'vue'
import { useClipboardItems } from '@vueuse/core'

/** The part of a vue-data-ui chart instance we need to export a PNG. */
type ChartWithImageExport = {
  getImage: (options?: { scale?: number }) => Promise<{ imageUri: string }>
}

/**
 * Copy a chart's PNG export to the clipboard, next to the built-in download.
 *
 * `isCopyingPng` has to be added to the `#svg` slot guard next to
 * `svg.isPrintingImg`: the chart only raises its own printing flag for the
 * built-in export buttons, so without it the copied image would be missing the
 * watermark that the downloaded one has.
 */
export function useCopyChartPng(
  chartRef: MaybeRefOrGetter<ChartWithImageExport | null | undefined>,
) {
  const { copy, copied: copiedPng, isSupported } = useClipboardItems()
  const { announce } = useCommandPalette()
  const { t } = useI18n()
  const isCopyingPng = shallowRef(false)

  async function copyChartPng() {
    const chart = toValue(chartRef)
    if (!chart || !isSupported.value || isCopyingPng.value) return

    isCopyingPng.value = true

    // Everything up to `copy()` stays synchronous, and the item is handed a
    // pending blob: awaiting the export first would spend the user activation
    // that Safari requires for navigator.clipboard.write.
    try {
      const png = nextTick()
        .then(() => chart.getImage())
        .then(({ imageUri }) => {
          // Decode the data URI manually: fetch() on data: URIs is blocked by the CSP
          const binary = atob(imageUri.slice(imageUri.indexOf(',') + 1))
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          return new Blob([bytes], { type: 'image/png' })
        })

      await copy([new ClipboardItem({ 'image/png': png })])
      // The button only swaps its icon, which says nothing to a screen reader
      announce(t('command_palette.announcements.copied_to_clipboard'))
    } finally {
      isCopyingPng.value = false
    }
  }

  return { copiedPng, isCopyingPng, copyChartPng }
}
