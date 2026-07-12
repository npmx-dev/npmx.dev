import { generateWatermarkLogo } from '~~/shared/utils/trends-chart'

/**
 * Shared utilities for chart watermarks and legends in SVG/PNG exports
 */

interface WatermarkColors {
  fg: string
  bg: string
  fgSubtle: string
}

/**
 * Build and return legend as SVG for export
 * Legend items are displayed in a column, at the top left of the chart.
 */
export function drawSvgPrintLegend(svg: Record<string, any>, colors: WatermarkColors) {
  const data = Array.isArray(svg?.data) ? svg.data : []
  if (!data.length) return ''

  const seriesNames: string[] = []

  data.forEach((serie, index) => {
    seriesNames.push(`
      <rect
        x="${svg.drawingArea.left + 12}"
        y="${svg.drawingArea.top + 24 * index - 7}"
        width="12"
        height="12"
        fill="${serie.color}"
        rx="3"
      />
      <text
        text-anchor="start"
        dominant-baseline="middle"
        x="${svg.drawingArea.left + 32}"
        y="${svg.drawingArea.top + 24 * index}"
        font-size="16"
        fill="${colors.fg}"
        stroke="${colors.bg}"
        stroke-width="1"
        paint-order="stroke fill"
      >
        ${serie.name}
      </text>
  `)
  })

  return seriesNames.join('')
}

/**
 * Build and return npmx svg logo and tagline, to be injected during PNG & SVG exports
 * for VueUiXy instances
 */
export function drawNpmxLogoAndTaglineWatermark({
  svg,
  colors,
  translateFn,
  positioning = 'bottom',
  sizeRatioLogo = 1,
  sizeRatioTagline = 1,
  offsetYTagline = -6,
  offsetYLogo = 0,
}: {
  svg: Record<string, any>
  colors: WatermarkColors
  translateFn: (key: string) => string
  positioning?: 'bottom' | 'belowDrawingArea'
  sizeRatioLogo?: number
  sizeRatioTagline?: number
  offsetYTagline?: number
  offsetYLogo?: number
}) {
  if (!svg?.drawingArea) return ''
  const npmxLogoWidthToHeight = 2.64 * sizeRatioLogo
  const npmxLogoWidth = 100 * sizeRatioLogo
  const npmxLogoHeight = npmxLogoWidth / npmxLogoWidthToHeight

  // Position watermark based on the positioning strategy
  const watermarkY =
    positioning === 'belowDrawingArea'
      ? svg.drawingArea.top + svg.drawingArea.height + 58
      : svg.height - npmxLogoHeight

  const taglineY =
    positioning === 'belowDrawingArea'
      ? watermarkY + offsetYTagline
      : svg.height - npmxLogoHeight + offsetYTagline

  // Center the watermark horizontally relative to the full SVG width
  const watermarkX = svg.width / 2 - npmxLogoWidth / 2

  return `
    ${generateWatermarkLogo({ x: watermarkX, y: watermarkY + offsetYLogo, width: npmxLogoWidth, height: npmxLogoHeight, fill: colors.fg })}
    <text
      fill="${colors.fgSubtle}"
      x="${svg.width / 2}"
      y="${taglineY}"
      font-size="${12 * sizeRatioTagline}"
      text-anchor="middle"
    >
      ${translateFn('tagline')}
    </text>
  `
}

/**
 * Build and return npmx svg logo and tagline, to be injected during PNG & SVG exports
 * for VueUiHorizontalBar instances
 */
export function drawSmallNpmxLogoAndTaglineWatermark({
  svg,
  colors,
  translateFn,
  logoWidth = 36,
  taglineFontSize = 8,
  offsetYTagline = 0,
  offsetXTagline = 0,
  offsetYLogo = 0,
}: {
  svg: Record<string, any>
  colors: WatermarkColors
  translateFn: (key: string) => string
  logoWidth?: number
  taglineFontSize?: number
  offsetYTagline?: number
  offsetXTagline?: number
  offsetYLogo?: number
}) {
  if (!svg.height) return

  const npmxLogoWidthToHeight = 2.64
  const npmxLogoHeight = logoWidth / npmxLogoWidthToHeight
  const offsetX = 6
  const watermarkY = svg.height - npmxLogoHeight + offsetYLogo
  const taglineY = svg.height - 3

  return `
    ${generateWatermarkLogo({ x: offsetX, y: watermarkY, width: logoWidth, height: npmxLogoHeight, fill: colors.fg })}
    <text
      fill="${colors.fgSubtle}"
      x="${logoWidth + offsetX * 2 + offsetXTagline}"
      y="${taglineY + offsetYTagline}"
      font-size="${taglineFontSize}"
      text-anchor="start"
    >
      ${translateFn('tagline')}
    </text>
  `
}
