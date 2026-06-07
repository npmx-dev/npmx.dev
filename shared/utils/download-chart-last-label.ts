/**
 * Utility to be used in vue-data-ui line charts (`VueUiXy`) using the `#svg` slot to display the last value as data label.
 * In case of mutliple series, if label collisions are detected, labels are distributed as close as possible to their related datapoint,  shifted to avoid overlaps, and linked to the last datapoint with an elbowed marker
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
    return firstLabel.y - secondLabel.y
  })

  const minimumLabelY = drawingAreaTop + labelHeight / 2
  const maximumLabelY = drawingAreaBottom - labelHeight / 2

  const positionedLabels = sortedLabels.map(label => ({
    ...label,
    labelY: Math.min(maximumLabelY, Math.max(minimumLabelY, label.y)),
  }))

  for (let index = 1; index < positionedLabels.length; index += 1) {
    const previousLabel = positionedLabels[index - 1]
    const currentLabel = positionedLabels[index]
    if (!previousLabel || !currentLabel) continue
    if (currentLabel.labelY - previousLabel.labelY < labelHeight) {
      currentLabel.labelY = previousLabel.labelY + labelHeight
    }
  }

  const lastLabel = positionedLabels.at(-1)
  if (!lastLabel) return ''
  const overflow = lastLabel.labelY - maximumLabelY

  if (overflow > 0) {
    for (const label of positionedLabels) {
      label.labelY -= overflow
    }
  }

  const labelX = Math.max(...positionedLabels.map(label => label.x)) + labelOffset + 10

  return positionedLabels
    .map(label => {
      const connectorStartX = label.x + 5
      const connectorEndX = labelX

      return `
        <path
          d="M${connectorStartX},${label.y} ${connectorStartX + 6},${label.y} ${connectorEndX},${label.labelY} ${connectorEndX + 6},${label.labelY}"
          stroke="${label.color}"
          stroke-width="1"
          opacity="${isDarkMode ? '0.7' : '1'}"
          fill="none"
        />
        <text
          text-anchor="start"
          dominant-baseline="middle"
          x="${connectorEndX + 12}"
          y="${label.labelY}"
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
