import { describe, expect, it } from 'vitest'
import { getDownloadChartGaps } from '#shared/utils/download-chart-gaps'

const drawingArea = { left: 10, right: 90, top: 20, bottom: 120 }
const plots = (values: Array<number | null>) =>
  values.map((value, index) => ({ x: 10 + index * 20, value }))

describe('download chart gap covers', () => {
  it('covers consecutive missing points between valid neighbors', () => {
    expect(
      getDownloadChartGaps({
        drawingArea,
        data: [{ color: 'green', plots: plots([1, null, null, 2, 3]) }],
      }),
    ).toEqual([{ x: 10, y: 20, width: 60, height: 100, color: 'green' }])
  })

  it('clips leading and trailing gaps to the drawing area', () => {
    expect(
      getDownloadChartGaps({
        drawingArea,
        data: [{ color: 'green', plots: plots([null, 1, 2, null, null]) }],
      }),
    ).toEqual([
      { x: 10, y: 20, width: 20, height: 100, color: 'green' },
      { x: 50, y: 20, width: 40, height: 100, color: 'green' },
    ])
  })

  it('keeps genuine zeros and ignores hidden or unplotted series', () => {
    expect(
      getDownloadChartGaps({
        drawingArea,
        data: [
          { color: 'green', plots: plots([1, 0, 2]) },
          { color: 'red', isSegregated: true, plots: plots([null, null]) },
          { color: 'blue' },
        ],
      }),
    ).toEqual([])
  })
})
