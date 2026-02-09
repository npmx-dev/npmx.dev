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
 * Legend items are displayed in a column, on the top left of the chart.
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
 */
export function drawNpmxLogoAndTaglineWatermark(
  svg: Record<string, any>,
  colors: WatermarkColors,
  translateFn: (key: string) => string,
  positioning: 'bottom' | 'belowDrawingArea' = 'bottom',
) {
  if (!svg?.drawingArea) return ''
  const npmxLogoWidthToHeight = 2.64
  const npmxLogoWidth = 100
  const npmxLogoHeight = npmxLogoWidth / npmxLogoWidthToHeight

  // Position watermark based on the positioning strategy
  const watermarkY =
    positioning === 'belowDrawingArea'
      ? svg.drawingArea.top + svg.drawingArea.height + 48
      : svg.height - npmxLogoHeight

  const taglineY =
    positioning === 'belowDrawingArea' ? watermarkY - 6 : svg.height - npmxLogoHeight - 6

  // Center the watermark horizontally relative to the full SVG width
  const watermarkX = svg.width / 2 - npmxLogoWidth / 2

  return `
    <svg x="${watermarkX}" y="${watermarkY}" width="${npmxLogoWidth}" height="${npmxLogoHeight}" viewBox="0 0 330 125" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.848 97V85.288H34.752V97H22.848ZM56.4105 107.56L85.5945 25H93.2745L64.0905 107.56H56.4105ZM121.269 97V46.12H128.661L128.949 59.08L127.989 58.216C128.629 55.208 129.781 52.744 131.445 50.824C133.173 48.84 135.221 47.368 137.589 46.408C139.957 45.448 142.453 44.968 145.077 44.968C148.981 44.968 152.213 45.832 154.773 47.56C157.397 49.288 159.381 51.624 160.725 54.568C162.069 57.448 162.741 60.68 162.741 64.264V97H154.677V66.568C154.677 61.832 153.749 58.248 151.893 55.816C150.037 53.32 147.189 52.072 143.349 52.072C140.725 52.072 138.357 52.648 136.245 53.8C134.133 54.888 132.437 56.52 131.157 58.696C129.941 60.808 129.333 63.432 129.333 66.568V97H121.269ZM173.647 111.4V46.12H181.135L181.327 57.64L180.175 57.064C181.455 53.096 183.568 50.088 186.512 48.04C189.519 45.992 192.976 44.968 196.88 44.968C201.936 44.968 206.064 46.216 209.264 48.712C212.528 51.208 214.928 54.472 216.464 58.504C218 62.536 218.767 66.888 218.767 71.56C218.767 76.232 218 80.584 216.464 84.616C214.928 88.648 212.528 91.912 209.264 94.408C206.064 96.904 201.936 98.152 196.88 98.152C194.256 98.152 191.792 97.704 189.487 96.808C187.247 95.912 185.327 94.664 183.727 93.064C182.191 91.464 181.135 89.576 180.559 87.4L181.711 86.056V111.4H173.647ZM196.111 90.472C200.528 90.472 203.984 88.808 206.48 85.48C209.04 82.152 210.319 77.512 210.319 71.56C210.319 65.608 209.04 60.968 206.48 57.64C203.984 54.312 200.528 52.648 196.111 52.648C193.167 52.648 190.607 53.352 188.431 54.76C186.319 56.168 184.655 58.28 183.439 61.096C182.287 63.912 181.711 67.4 181.711 71.56C181.711 75.72 182.287 79.208 183.439 82.024C184.591 84.84 186.255 86.952 188.431 88.36C190.607 89.768 193.167 90.472 196.111 90.472ZM222.57 97V46.12H229.962L230.25 57.448L229.29 57.256C229.866 53.48 231.082 50.504 232.938 48.328C234.858 46.088 237.29 44.968 240.234 44.968C243.242 44.968 245.546 46.056 247.146 48.232C248.81 50.408 249.834 53.608 250.218 57.832H249.258C249.834 53.864 251.114 50.728 253.098 48.424C255.146 46.12 257.706 44.968 260.778 44.968C264.874 44.968 267.85 46.376 269.706 49.192C271.562 52.008 272.49 56.68 272.49 63.208V97H264.426V64.36C264.426 59.816 263.946 56.648 262.986 54.856C262.026 53 260.522 52.072 258.474 52.072C257.13 52.072 255.946 52.52 254.922 53.416C253.898 54.248 253.066 55.592 252.426 57.448C251.85 59.304 251.562 61.672 251.562 64.552V97H243.498V64.36C243.498 60.008 243.018 56.872 242.058 54.952C241.162 53.032 239.658 52.072 237.546 52.072C236.202 52.072 235.018 52.52 233.994 53.416C232.97 54.248 232.138 55.592 231.498 57.448C230.922 59.304 230.634 61.672 230.634 64.552V97H222.57ZM276.676 97L295.396 70.888L277.636 46.12H287.044L300.388 65.32L313.444 46.12H323.044L305.38 71.08L323.908 97H314.5L300.388 76.456L286.276 97H276.676Z" fill="${colors.fg}"/>
    </svg>
    <text
      fill="${colors.fgSubtle}"
      x="${svg.width / 2}"
      y="${taglineY}"
      font-size="12"
      text-anchor="middle"
    >
      ${translateFn('tagline')}
    </text>
  `
}
