type GapPlot = { x: number; value: unknown }

/**
 * Cover the empty interval between the valid points on either side of each gap
 * Used for download charts (TrendsChart as well as the embed ssr variant)
 */
export function getDownloadChartGaps({
  data,
  drawingArea,
}: {
  data: Array<{ color: string; plots?: GapPlot[]; isSegregated?: boolean }>
  drawingArea: { left: number; right: number; top: number; bottom: number }
}) {
  const rectangles: Array<{ x: number; y: number; width: number; height: number; color: string }> =
    []
  for (const serie of data) {
    if (!serie.plots || serie.isSegregated) {
      continue
    }

    let index = 0

    while (index < serie.plots.length) {
      if (serie.plots[index]?.value != null) {
        index += 1
        continue
      }

      const start = index

      while (index < serie.plots.length && serie.plots[index]?.value == null) {
        index += 1
      }

      const left = Math.max(drawingArea.left, serie.plots[start - 1]?.x ?? drawingArea.left)
      const right = Math.min(drawingArea.right, serie.plots[index]?.x ?? drawingArea.right)
      const height = drawingArea.bottom - drawingArea.top

      if (Number.isFinite(left) && Number.isFinite(right) && right > left && height > 0) {
        rectangles.push({
          x: left,
          y: drawingArea.top,
          width: right - left,
          height,
          color: serie.color,
        })
      }
    }
  }
  return rectangles
}
