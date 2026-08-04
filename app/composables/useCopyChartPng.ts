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
  const { copy, copied: copiedPng } = useClipboardItems()
  const isCopyingPng = shallowRef(false)

  async function copyChartPng() {
    const chart = toValue(chartRef)
    if (!chart) return

    isCopyingPng.value = true
    await nextTick()

    const { imageUri } = await chart.getImage().finally(() => {
      isCopyingPng.value = false
    })

    // Decode the data URI manually: fetch() on data: URIs is blocked by the CSP
    const binary = atob(imageUri.slice(imageUri.indexOf(',') + 1))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    await copy([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })])
  }

  return { copiedPng, isCopyingPng, copyChartPng }
}
