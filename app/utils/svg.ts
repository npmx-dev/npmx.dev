/**
 * Convert an SVG (URL or data URI) into a PNG Blob.
 *
 * @param svgUrl - URL or data URI pointing to the SVG to convert. If remote,
 *                 the resource must be accessible (CORS allowed) for use in a canvas.
 * @param width - Desired logical width (CSS pixels) of the output image.
 * @param height - Desired logical height (CSS pixels) of the output image.
 * @param scale - Optional pixel scale multiplier (use 2 for high-DPI output). Default: 2.
 * @returns A Promise that resolves with a PNG Blob containing the rendered image.
 * @throws {Error} If the SVG fails to load or if the canvas cannot produce a Blob.
 */
export async function svgToPng(
  svgUrl: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  await document.fonts.ready

  const img = new Image()
  img.crossOrigin = 'anonymous'

  const loaded = new Promise<void>((resolve, reject) => {
    // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
    img.onload = () => resolve()
    // oxlint-disable-next-line eslint-plugin-unicorn(prefer-add-event-listener)
    img.onerror = () => reject(new Error(`Failed to load SVG: ${svgUrl}`))
  })

  img.src = svgUrl
  await loaded

  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale

  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}
