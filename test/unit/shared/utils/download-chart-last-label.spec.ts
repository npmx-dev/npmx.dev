import { describe, expect, it, vi } from 'vitest'
import { createLastDatapointLabelsSvg } from '#shared/utils/download-chart-last-label'

const colors = {
  foreground: '#000000',
  background: '#FFFFFF',
  fallbackSerieColor: '#999999',
}

describe('createLastDatapointLabelsSvg', () => {
  it('returns an empty string when there are no series', () => {
    const result = createLastDatapointLabelsSvg({
      series: [],
      drawingArea: { top: 10, height: 100 },
      colors,
      formatValue: value => String(value),
      isDarkMode: false,
    })
    expect(result).toBe('')
  })

  it('returns an empty string when no serie has plots', () => {
    const result = createLastDatapointLabelsSvg({
      series: [{ color: '#FF0000' }, { color: '#00FF00', plots: [] }],
      drawingArea: { top: 10, height: 100 },
      colors,
      formatValue: value => String(value),
      isDarkMode: false,
    })

    expect(result).toBe('')
  })

  it('renders regular labels when there is no collision', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 20, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 90, value: 20 }] },
      ],
      drawingArea: { top: 0, height: 120 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('<text')
    expect(result).not.toContain('<path')
    expect(result).toContain('x="124"')
    expect(result).toContain('y="20"')
    expect(result).toContain('y="90"')
    expect(result).toContain('10')
    expect(result).toContain('20')
  })

  it('uses custom font size, label offset, and colors in regular labels', () => {
    const result = createLastDatapointLabelsSvg({
      series: [{ plots: [{ x: 10, y: 20, value: 42 }] }],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
      fontSize: 12,
      labelOffset: 10,
    })
    expect(result).toContain('x="20"')
    expect(result).toContain('font-size="12"')
    expect(result).toContain('fill="#000000"')
    expect(result).toContain('stroke="#FFFFFF"')
  })

  it('uses only the last plot of each serie', () => {
    const formatValue = vi.fn((value: number) => `${value}`)
    const result = createLastDatapointLabelsSvg({
      series: [
        {
          color: '#FF0000',
          plots: [
            { x: 10, y: 10, value: 1 },
            { x: 50, y: 50, value: 99 },
          ],
        },
      ],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue,
      isDarkMode: false,
    })
    expect(formatValue).toHaveBeenCalledTimes(1)
    expect(formatValue).toHaveBeenCalledWith(99)
    expect(result).toContain('x="74"')
    expect(result).toContain('y="50"')
    expect(result).not.toContain('x="34"')
  })

  it('formats safe numeric values and falls back to zero for invalid values', () => {
    const formatValue = vi.fn((value: number) => `value:${value}`)
    const result = createLastDatapointLabelsSvg({
      series: [{ plots: [{ x: 10, y: 20, value: Number.NaN }] }],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue,
      isDarkMode: false,
    })
    expect(formatValue).toHaveBeenCalledWith(0)
    expect(result).toContain('value:0')
  })

  it('renders collision labels as a vertically distributed label rack', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 55, value: 30 }] },
        { color: '#0000FF', plots: [{ x: 100, y: 60, value: 20 }] },
      ],
      drawingArea: { top: 10, height: 120 },
      colors,
      formatValue: value => `value-${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('<path')
    expect(result).toContain('opacity="1"')
    expect(result).toContain('stroke="#00FF00"')
    expect(result).toContain('stroke="#0000FF"')
    expect(result).toContain('stroke="#FF0000"')
    expect(result.indexOf('value-30')).toBeLessThan(result.indexOf('value-20'))
    expect(result.indexOf('value-20')).toBeLessThan(result.indexOf('value-10'))
    expect(result).toContain('y="25"')
    expect(result).toContain('y="70"')
    expect(result).toContain('y="115"')
  })

  it('uses drawingArea.bottom when height is not provided', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 55, value: 20 }] },
      ],
      drawingArea: { top: 20, bottom: 120 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('y="35"')
    expect(result).toContain('y="105"')
  })

  it('centers the collision label when only one label is rendered in rack mode', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 50, value: 20 }] },
      ],
      drawingArea: { top: 20, height: 100 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('y="35"')
    expect(result).toContain('y="105"')
  })

  it('uses dark-mode opacity in collision mode', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 50, value: 20 }] },
      ],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: true,
    })

    expect(result).toContain('opacity="0.7"')
  })

  it('uses the fallback serie color when no color is provided', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { plots: [{ x: 100, y: 50, value: 10 }] },
        { plots: [{ x: 100, y: 50, value: 20 }] },
      ],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })

    expect(result).toContain('stroke="#999999"')
  })

  it('supports null plot values from SSR slot data', () => {
    const result = createLastDatapointLabelsSvg({
      series: [{ plots: [{ x: 10, y: 20, value: null }] }],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `formatted:${value}`,
      isDarkMode: false,
    })

    expect(result).toContain('formatted:0')
  })

  it('uses zero defaults when plot coordinates are nullish', () => {
    const result = createLastDatapointLabelsSvg({
      series: [{ plots: [{ x: null, y: null, value: undefined }] }],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `value-${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('x="24"')
    expect(result).toContain('y="0"')
    expect(result).toContain('value-0')
  })

  it('uses zero drawing area height when neither height nor bottom is provided', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 50, value: 20 }] },
      ],
      drawingArea: { top: 20 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('y="35"')
    expect(result).toContain('y="-15"')
  })

  it('renders a regular label when serie color is omitted', () => {
    const result = createLastDatapointLabelsSvg({
      series: [{ plots: [{ x: 100, y: 50, value: 10 }] }],
      drawingArea: { top: 0, height: 100 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
    })
    expect(result).toContain('<text')
    expect(result).not.toContain('<path')
    expect(result).toContain('x="124"')
    expect(result).toContain('10')
  })

  it('supports custom labelHeight in collision rack mode', () => {
    const result = createLastDatapointLabelsSvg({
      series: [
        { color: '#FF0000', plots: [{ x: 100, y: 50, value: 10 }] },
        { color: '#00FF00', plots: [{ x: 100, y: 50, value: 20 }] },
      ],
      drawingArea: { top: 10, height: 110 },
      colors,
      formatValue: value => `${value}`,
      isDarkMode: false,
      labelHeight: 20,
    })
    expect(result).toContain('y="20"')
    expect(result).toContain('y="110"')
  })
})
