/**
 * Utility to be used in vue-data-ui line charts (`VueUiXy`) using the `#svg` slot to display the last value as data label.
 * In case of mutliple series, if label collisions are detected, labels are evenly distributed vertically,
 * and linked to the last datapoint with an elbowed marker
 */
export function createLastDatapointLabelsSvg({
  series,
  drawingArea,
  colors,
  formatValue,
  isDarkMode,
  fontSize = 20,
  labelOffset = 24,
  labelHeight = 30,
}: {
  series: LastDatapointLabelSerie[]
  drawingArea: {
    top: number
    height?: number
    bottom?: number
  }
  colors: LastDatapointLabelColors
  formatValue: (value: number) => string
  isDarkMode: boolean
  svgWidth?: number
  fontSize?: number
  labelOffset?: number
  labelHeight?: number
}) {
  const drawingAreaTop = Number(drawingArea.top ?? 0)
  const drawingAreaHeight = Number(
    drawingArea.height ?? Number(drawingArea.bottom ?? 0) - drawingAreaTop,
  )
  const drawingAreaBottom = drawingAreaTop + drawingAreaHeight

  const labels = series
    .map(serie => {
      const lastPlot = Array.isArray(serie.plots) ? serie.plots.at(-1) : null
      if (!lastPlot) return null

      const value = Number(lastPlot.value ?? 0)
      const safeValue = Number.isFinite(value) ? value : 0
      const text = formatValue(safeValue)

      return {
        x: Number(lastPlot.x ?? 0),
        y: Number(lastPlot.y ?? 0),
        value: safeValue,
        color: String(serie.color ?? colors.fallbackSerieColor),
        text,
        width: text.length * fontSize * 0.58,
      }
    })
    .filter(isLastDatapointLabel)

  if (!labels.length) return ''

  const hasCollision = labels.some((label, labelIndex) =>
    labels.some((otherLabel, otherLabelIndex) => {
      if (labelIndex === otherLabelIndex) return false

      return (
        label.x + labelOffset < otherLabel.x + labelOffset + otherLabel.width &&
        label.x + labelOffset + label.width > otherLabel.x + labelOffset &&
        label.y - labelHeight / 2 < otherLabel.y + labelHeight / 2 &&
        label.y + labelHeight / 2 > otherLabel.y - labelHeight / 2
      )
    }),
  )

  if (!hasCollision) {
    return labels
      .map(
        label => `
          <text
            text-anchor="start"
            dominant-baseline="middle"
            x="${label.x + labelOffset}"
            y="${label.y}"
            font-size="${fontSize}"
            fill="${colors.foreground}"
            stroke="${colors.background}"
            stroke-width="1"
            paint-order="stroke fill"
          >
            ${label.text}
          </text>
        `,
      )
      .join('\n')
  }

  const sortedLabels = [...labels].sort((firstLabel, secondLabel) => {
    return secondLabel.value - firstLabel.value
  })

  const availableHeight = drawingAreaBottom - drawingAreaTop - labelHeight
  const verticalStep = availableHeight / (sortedLabels.length - 1)

  const labelX = Math.max(...sortedLabels.map(label => label.x)) + labelOffset + 10

  return sortedLabels
    .map((label, index) => {
      const labelY = drawingAreaTop + labelHeight / 2 + verticalStep * index
      const connectorStartX = label.x + 5
      const connectorEndX = labelX

      return `
        <path
          d="M${connectorStartX},${label.y} ${connectorStartX + 6},${label.y} ${connectorEndX},${labelY} ${connectorEndX + 6},${labelY}"
          stroke="${label.color}"
          stroke-width="1"
          opacity="${isDarkMode ? '0.7' : '1'}"
          fill="none"
        />
        <text
          text-anchor="start"
          dominant-baseline="middle"
          x="${connectorEndX + 12}"
          y="${labelY}"
          font-size="${fontSize}"
          fill="${colors.foreground}"
          stroke="${colors.background}"
          stroke-width="1"
          paint-order="stroke fill"
        >
          ${label.text}
        </text>
      `
    })
    .join('\n')
}

export type LastDatapointLabelColors = {
  foreground: string
  background: string
  fallbackSerieColor: string
}

export type LastDatapointLabelSerie = {
  color?: string
  plots?: {
    x?: number | null
    y?: number | null
    value?: number | null
  }[]
}

type LastDatapointLabel = {
  x: number
  y: number
  value: number
  color: string
  text: string
  width: number
}

function isLastDatapointLabel(label: LastDatapointLabel | null): label is LastDatapointLabel {
  return label !== null
}
