import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildNormalisedTrendsDataset,
  buildTrendsChartConfig,
  buildTrendsChartData,
  drawTrendsEstimationLine,
  drawTrendsLastDatapointLabel,
  drawTrendsSvgPrintLegend,
  generateWatermarkLogo,
  getTrendsDatetimeFormatterOptions,
  isDailyDataset,
  isMonthlyDataset,
  isWeeklyDataset,
  isYearlyDataset,
} from '#shared/utils/trends-chart'

const {
  lightenOklchMock,
  getFrameworkColorMock,
  isListedFrameworkMock,
  applyEllipsisMock,
  applyDataPipelineMock,
} = vi.hoisted(() => ({
  lightenOklchMock: vi.fn(),
  getFrameworkColorMock: vi.fn(),
  isListedFrameworkMock: vi.fn(),
  applyEllipsisMock: vi.fn(),
  applyDataPipelineMock: vi.fn(),
}))

vi.mock('~/utils/colors', () => ({
  OKLCH_NEUTRAL_FALLBACK: 'oklch-fallback',
  lightenOklch: lightenOklchMock,
}))

vi.mock('~/utils/frameworks', () => ({
  getFrameworkColor: getFrameworkColorMock,
  isListedFramework: isListedFrameworkMock,
}))

vi.mock('~/utils/charts', () => ({
  applyEllipsis: applyEllipsisMock,
}))

vi.mock('~/utils/chart-data-prediction', () => ({
  DEFAULT_PREDICTION_POINTS: 12,
  applyDataPipeline: applyDataPipelineMock,
}))

const colors = {
  bg: '#ffffff',
  bgElevated: '#f8f8f8',
  fg: '#111111',
  fgMuted: '#666666',
  fgSubtle: '#999999',
  border: '#dddddd',
}

const translate = (key: string, params?: Record<string, unknown>) => {
  if (!params) {
    return key
  }

  return `${key}:${JSON.stringify(params)}`
}

const compactNumberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function baseChartDataOptions() {
  return {
    packageNames: ['vue'],
    isMultiPackageMode: false,
    selectedMetric: 'downloads' as const,
    selectedMetricLabel: 'Downloads',
    selectedGranularity: 'daily' as const,
    displayedGranularity: 'daily' as const,
    singleEvolution: [],
    colors,
    isDarkMode: false,
    chartFilter: {
      averageWindow: 1,
      smoothingTau: 0,
    },
    t: translate,
    compactNumberFormatter,
  }
}

function baseConfigOptions() {
  return {
    packageNames: ['vue'],
    isMultiPackageMode: false,
    selectedMetric: 'downloads' as const,
    selectedMetricLabel: 'Downloads',
    selectedGranularity: 'daily' as const,
    displayedGranularity: 'daily' as const,
    singleEvolution: [],
    colors,
    isDarkMode: false,
    chartFilter: {
      averageWindow: 1,
      smoothingTau: 0,
    },
    t: translate,
    compactNumberFormatter,
    dates: [1, 2],
    isMobile: false,
    pending: false,
    locale: 'en',
    chartHeight: 400,
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  lightenOklchMock.mockReturnValue('lightened-accent')
  getFrameworkColorMock.mockReturnValue('#42b883')
  isListedFrameworkMock.mockImplementation((packageName: string) => packageName === 'vue')
  applyEllipsisMock.mockImplementation((value: string) => value)
  applyDataPipelineMock.mockImplementation((series: number[]) => series)
})

describe('dataset guards', () => {
  it('detects weekly datasets', () => {
    expect(
      isWeeklyDataset([
        {
          weekKey: '2026-W01',
          weekStart: '2026-01-01',
          weekEnd: '2026-01-07',
          timestampStart: 1,
          timestampEnd: 2,
          value: 10,
        },
      ]),
    ).toBe(true)

    expect(isWeeklyDataset([])).toBe(false)
    expect(isWeeklyDataset(null)).toBe(false)
    expect(isWeeklyDataset([{ value: 10 }])).toBe(false)
  })

  it('detects daily datasets', () => {
    expect(isDailyDataset([{ day: '2026-01-01', timestamp: 1, value: 10 }])).toBe(true)
    expect(isDailyDataset([])).toBe(false)
    expect(isDailyDataset(null)).toBe(false)
    expect(isDailyDataset([{ value: 10 }])).toBe(false)
  })

  it('detects monthly datasets', () => {
    expect(isMonthlyDataset([{ month: '2026-01', timestamp: 1, value: 10 }])).toBe(true)
    expect(isMonthlyDataset([])).toBe(false)
    expect(isMonthlyDataset(null)).toBe(false)
    expect(isMonthlyDataset([{ value: 10 }])).toBe(false)
  })

  it('detects yearly datasets', () => {
    expect(isYearlyDataset([{ year: '2026', timestamp: 1, value: 10 }])).toBe(true)
    expect(isYearlyDataset([])).toBe(false)
    expect(isYearlyDataset(null)).toBe(false)
    expect(isYearlyDataset([{ value: 10 }])).toBe(false)
  })
})

describe('buildTrendsChartData', () => {
  it('formats a single daily dataset', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      singleEvolution: [
        { day: '2026-01-01', timestamp: 1, value: 10, hasAnomaly: true },
        { day: '2026-01-02', timestamp: 2, value: 20 },
      ],
      accent: '#abcdef',
    })

    expect(result).toEqual({
      dataset: [
        expect.objectContaining({
          name: 'vue',
          type: 'line',
          series: [10, 20],
          color: '#abcdef',
          temperatureColors: undefined,
          useArea: true,
          dashIndices: [0],
        }),
      ],
      dates: [1, 2],
    })
  })

  it('uses an empty series name when packageNames is empty in single-package mode', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: [],
      singleEvolution: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
    })

    expect(result.dataset?.[0]?.name).toBe('')
    expect(applyEllipsisMock).toHaveBeenCalledWith('', 32)
  })

  it('formats weekly, monthly, and yearly single datasets', () => {
    expect(
      buildTrendsChartData({
        ...baseChartDataOptions(),
        selectedGranularity: 'weekly',
        displayedGranularity: 'weekly',
        singleEvolution: [
          {
            weekKey: '2026-W01',
            weekStart: '2026-01-01',
            weekEnd: '2026-01-07',
            timestampStart: 1,
            timestampEnd: 2,
            value: 10,
          },
        ],
      }).dates,
    ).toEqual([2])

    expect(
      buildTrendsChartData({
        ...baseChartDataOptions(),
        selectedGranularity: 'monthly',
        displayedGranularity: 'monthly',
        singleEvolution: [{ month: '2026-01', timestamp: 3, value: 10 }],
      }).dates,
    ).toEqual([3])

    expect(
      buildTrendsChartData({
        ...baseChartDataOptions(),
        selectedGranularity: 'yearly',
        displayedGranularity: 'yearly',
        singleEvolution: [{ year: '2026', timestamp: 4, value: 10 }],
      }).dates,
    ).toEqual([4])
  })

  it('returns null for an invalid single dataset', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      singleEvolution: [],
    })

    expect(result).toEqual({
      dataset: null,
      dates: [],
    })
  })

  it('uses fallback accent and dark mode temperature colors', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      singleEvolution: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      colors: { ...colors, fgSubtle: undefined as never },
      isDarkMode: true,
    })

    expect(lightenOklchMock).toHaveBeenCalledWith('oklch-fallback', 0.618)
    expect(result.dataset?.[0]).toMatchObject({
      color: 'oklch-fallback',
      temperatureColors: ['lightened-accent', 'oklch-fallback'],
    })
  })

  it('extracts daily points in multi-package mode', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue', 'react'],
      effectivePackageNamesForMetric: ['vue', 'react'],
      isMultiPackageMode: true,
      evolutionsByPackage: {
        vue: [{ day: '2026-01-01', timestamp: 100, value: 10, hasAnomaly: true }],
        react: [{ day: '2026-01-02', timestamp: 200, value: 20 }],
      },
    })

    expect(result.dates).toEqual([100, 200])
    expect(result.dataset).toEqual([
      expect.objectContaining({
        name: 'vue',
        series: [10, 0],
        dashIndices: [0],
        color: '#42b883',
      }),
      expect.objectContaining({
        name: 'react',
        series: [0, 20],
        dashIndices: [],
      }),
    ])
  })

  it('extracts monthly points in multi-package mode', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue', 'react'],
      effectivePackageNamesForMetric: ['vue', 'react'],
      isMultiPackageMode: true,
      selectedGranularity: 'monthly',
      displayedGranularity: 'monthly',
      evolutionsByPackage: {
        vue: [{ month: '2026-01', timestamp: 100, value: 10, hasAnomaly: true }],
        react: [{ month: '2026-02', timestamp: 200, value: 20 }],
      },
    })

    expect(result.dates).toEqual([100, 200])
    expect(result.dataset).toEqual([
      expect.objectContaining({
        name: 'vue',
        series: [10, 0],
        dashIndices: [0],
      }),
      expect.objectContaining({
        name: 'react',
        series: [0, 20],
        dashIndices: [],
      }),
    ])
  })

  it('extracts yearly points in multi-package mode', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue', 'react'],
      effectivePackageNamesForMetric: ['vue', 'react'],
      isMultiPackageMode: true,
      selectedGranularity: 'yearly',
      displayedGranularity: 'yearly',
      evolutionsByPackage: {
        vue: [{ year: '2025', timestamp: 100, value: 10, hasAnomaly: true }],
        react: [{ year: '2026', timestamp: 200, value: 20 }],
      },
    })

    expect(result.dates).toEqual([100, 200])
    expect(result.dataset).toEqual([
      expect.objectContaining({
        name: 'vue',
        series: [10, 0],
        dashIndices: [0],
      }),
      expect.objectContaining({
        name: 'react',
        series: [0, 20],
        dashIndices: [],
      }),
    ])
  })

  it('extracts weekly points in multi-package mode', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue', 'react'],
      effectivePackageNamesForMetric: ['vue', 'react'],
      isMultiPackageMode: true,
      selectedGranularity: 'weekly',
      displayedGranularity: 'weekly',
      evolutionsByPackage: {
        vue: [
          {
            weekKey: '2026-W01',
            weekStart: '2026-01-01',
            weekEnd: '2026-01-07',
            timestampStart: 100,
            timestampEnd: 200,
            value: 10,
            hasAnomaly: true,
          },
        ],
        react: [
          {
            weekKey: '2026-W02',
            weekStart: '2026-01-08',
            weekEnd: '2026-01-14',
            timestampStart: 201,
            timestampEnd: 300,
            value: 20,
          },
        ],
      },
    })

    expect(result.dates).toEqual([200, 300])
    expect(result.dataset).toEqual([
      expect.objectContaining({
        name: 'vue',
        series: [10, 0],
        dashIndices: [0],
      }),
      expect.objectContaining({
        name: 'react',
        series: [0, 20],
        dashIndices: [],
      }),
    ])
  })

  it('falls back to packageNames when effectivePackageNamesForMetric is not provided', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue'],
      isMultiPackageMode: true,
      evolutionsByPackage: {
        vue: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      },
    })

    expect(result.dataset?.[0]?.name).toBe('vue')
  })

  it('falls back to an empty point list when a mapped package was not collected', () => {
    const effectivePackageNamesForMetric = ['vue'] as unknown as string[]

    effectivePackageNamesForMetric.map = ((callback: (packageName: string) => unknown) =>
      ['vue', 'react'].map(callback)) as typeof effectivePackageNamesForMetric.map

    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue', 'react'],
      effectivePackageNamesForMetric,
      isMultiPackageMode: true,
      evolutionsByPackage: {
        vue: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      },
    })

    expect(result.dataset).toEqual([
      expect.objectContaining({
        name: 'vue',
        series: [10],
      }),
      expect.objectContaining({
        name: 'react',
        series: [0],
      }),
    ])
  })

  it('returns null for multi-package mode when no dates are available', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      isMultiPackageMode: true,
      evolutionsByPackage: {},
    })

    expect(result).toEqual({
      dataset: null,
      dates: [],
    })
  })

  it('returns null for multi-package mode when extracted points are invalid', () => {
    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue'],
      isMultiPackageMode: true,
      selectedGranularity: 'daily',
      displayedGranularity: 'daily',
      evolutionsByPackage: {
        vue: [{ month: '2026-01', timestamp: 1, value: 10 }] as never,
      },
    })

    expect(result).toEqual({
      dataset: null,
      dates: [],
    })
  })

  it('applies anomaly correction for downloads when enabled', () => {
    const applyAnomalyCorrection = vi.fn(() => [{ day: '2026-01-01', timestamp: 1, value: 99 }])

    const result = buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue'],
      isMultiPackageMode: true,
      evolutionsByPackage: {
        vue: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      },
      useAnomalyCorrection: true,
      applyAnomalyCorrection,
    })

    expect(applyAnomalyCorrection).toHaveBeenCalledWith({
      data: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      packageName: 'vue',
      granularity: 'daily',
    })
    expect(result.dataset?.[0]?.series).toEqual([99])
  })

  it('does not apply anomaly correction for non-download metrics', () => {
    const applyAnomalyCorrection = vi.fn()

    buildTrendsChartData({
      ...baseChartDataOptions(),
      packageNames: ['vue'],
      isMultiPackageMode: true,
      selectedMetric: 'likes',
      selectedMetricLabel: 'Likes',
      evolutionsByPackage: {
        vue: [{ day: '2026-01-01', timestamp: 1, value: 10 }],
      },
      useAnomalyCorrection: true,
      applyAnomalyCorrection,
    })

    expect(applyAnomalyCorrection).not.toHaveBeenCalled()
  })
})

describe('buildNormalisedTrendsDataset', () => {
  it('returns an empty array for null dataset', () => {
    expect(
      buildNormalisedTrendsDataset({
        dataset: null,
        dates: [],
        granularity: 'daily',
        selectedMetric: 'downloads',
        chartFilter: { averageWindow: 1, smoothingTau: 0 },
      }),
    ).toEqual([])
  })

  it('normalizes number, object, and invalid values before applying the pipeline', () => {
    applyDataPipelineMock.mockReturnValue([1, 2, 0])

    const result = buildNormalisedTrendsDataset({
      dataset: [
        {
          name: 'vue',
          type: 'line',
          series: [1, { x: 1, y: 2 }, 'bad'] as never,
        },
      ],
      dates: [10],
      granularity: 'daily',
      selectedMetric: 'downloads',
      chartFilter: { averageWindow: 2, smoothingTau: 3 },
      endDateMs: 500,
    })

    expect(applyDataPipelineMock).toHaveBeenCalledWith(
      [1, 2, 0],
      {
        averageWindow: 2,
        smoothingTau: 3,
        predictionPoints: 12,
      },
      {
        granularity: 'daily',
        lastDateMs: 10,
        referenceMs: 500,
        isAbsoluteMetric: false,
      },
    )

    expect(result).toEqual([
      expect.objectContaining({
        series: [1, 2, 0],
        dashIndices: [],
      }),
    ])
  })

  it('uses Date.now when endDateMs is missing', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(999)

    buildNormalisedTrendsDataset({
      dataset: [{ name: 'vue', type: 'line', series: [1] }],
      dates: [],
      granularity: 'daily',
      selectedMetric: 'downloads',
      chartFilter: { averageWindow: 1, smoothingTau: 0, predictionPoints: 4 },
    })

    expect(applyDataPipelineMock).toHaveBeenCalledWith(
      [1],
      expect.objectContaining({
        predictionPoints: 4,
      }),
      expect.objectContaining({
        lastDateMs: 0,
        referenceMs: 999,
      }),
    )

    dateNowSpy.mockRestore()
  })

  it('disables prediction points for weekly granularity', () => {
    buildNormalisedTrendsDataset({
      dataset: [{ name: 'vue', type: 'line', series: [1], dashIndices: [0] }],
      dates: [10],
      granularity: 'weekly',
      selectedMetric: 'contributors',
      chartFilter: { averageWindow: 0, smoothingTau: 0, predictionPoints: 5 },
      endDateMs: 100,
    })

    expect(applyDataPipelineMock).toHaveBeenCalledWith(
      [1],
      {
        averageWindow: 0,
        smoothingTau: 0,
        predictionPoints: 0,
      },
      {
        granularity: 'weekly',
        lastDateMs: 10,
        referenceMs: 100,
        isAbsoluteMetric: true,
      },
    )
  })
})

describe('getTrendsDatetimeFormatterOptions', () => {
  it('returns formatter options for each granularity', () => {
    expect(getTrendsDatetimeFormatterOptions('daily')).toEqual({
      year: 'yyyy-MM-dd',
      month: 'yyyy-MM-dd',
      day: 'yyyy-MM-dd',
    })

    expect(getTrendsDatetimeFormatterOptions('weekly')).toEqual({
      year: 'yyyy-MM-dd',
      month: 'yyyy-MM-dd',
      day: 'yyyy-MM-dd',
    })

    expect(getTrendsDatetimeFormatterOptions('monthly')).toEqual({
      year: 'MMM yyyy',
      month: 'MMM yyyy',
      day: 'MMM yyyy',
    })

    expect(getTrendsDatetimeFormatterOptions('yearly')).toEqual({
      year: 'yyyy',
      month: 'yyyy',
      day: 'yyyy',
    })
  })
})

describe('buildTrendsChartConfig', () => {
  it('builds a light desktop config with default tooltip behavior', () => {
    const config = buildTrendsChartConfig(baseConfigOptions())

    expect(config.theme).toBe('')
    expect(config.chart?.height).toBe(400)
    expect(config.chart?.padding?.bottom).toBe(64)
    expect(config.chart?.grid?.labels?.fontSize).toBe(16)
    expect(config.chart?.tooltip?.teleportTo).toBeUndefined()
    expect(config.chart?.tooltip?.position).toBe('center')
    expect(config.chart?.tooltip?.offsetY).toBe(-24)
    expect(config.chart?.timeTag?.backgroundColor).toBe('#f8f8f8')
  })

  it('falls back to bg when bgElevated is not provided', () => {
    const config = buildTrendsChartConfig({
      ...baseConfigOptions(),
      colors: {
        ...colors,
        bgElevated: undefined as never,
      },
    })

    expect(config.chart?.timeTag?.backgroundColor).toBe(colors.bg)
  })

  it('builds a dark mobile yearly multi-package config', () => {
    const config = buildTrendsChartConfig({
      ...baseConfigOptions(),
      packageNames: ['vue', 'react'],
      isMultiPackageMode: true,
      selectedGranularity: 'yearly',
      displayedGranularity: 'yearly',
      isDarkMode: true,
      dates: [1, 2],
      isMobile: true,
      pending: true,
      locale: 'fr-FR',
      chartHeight: 500,
      inModal: true,
      tooltipPosition: 'left',
    })

    expect(config.theme).toBe('dark')
    expect(config.chart?.padding?.bottom).toBe(84)
    expect(config.chart?.grid?.labels?.fontSize).toBe(24)
    expect(config.chart?.grid?.labels?.color).toBe(colors.border)
    expect(config.chart?.grid?.labels?.axis?.fontSize).toBe(32)
    expect(config.chart?.tooltip?.teleportTo).toBe('#chart-modal')
    expect(config.chart?.tooltip?.position).toBe('left')
    expect(config.chart?.tooltip?.offsetY).toBeUndefined()
  })

  it('formats finite and non-finite y-axis values', () => {
    const config = buildTrendsChartConfig(baseConfigOptions())

    const formatter = config.chart?.grid?.labels?.yAxis?.formatter as (payload: {
      value: number
    }) => string

    expect(formatter({ value: 1200 })).toBe('1.2K')
    expect(formatter({ value: Number.NaN })).toBe('0')
  })
})

describe('drawTrendsEstimationLine', () => {
  it('returns an empty string when rendering is disabled or no data exists', () => {
    expect(
      drawTrendsEstimationLine({
        svg: {},
        colors,
        shouldRender: false,
      }),
    ).toBe('')

    expect(
      drawTrendsEstimationLine({
        svg: {},
        colors,
        shouldRender: true,
      }),
    ).toBe('')
  })

  it('draws estimation lines from svg data', () => {
    const result = drawTrendsEstimationLine({
      svg: {
        data: [
          {
            color: '#ff0000',
            plots: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
        ],
      },
      colors,
      shouldRender: true,
    })

    expect(result).toContain('x1="1"')
    expect(result).toContain('x2="3"')
    expect(result).toContain('stroke="#ff0000"')
    expect(result).toContain('<circle')
  })

  it('uses svg series fallback and default stroke color', () => {
    const result = drawTrendsEstimationLine({
      svg: {
        series: [
          {
            plots: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
          {
            plots: [{ x: 1, y: 2 }],
          },
          {
            plots: null,
          },
        ],
      },
      colors,
      shouldRender: true,
    })

    expect(result).toContain(`stroke="${colors.fg}"`)
  })

  it('skips estimation lines when previous or last plot is missing', () => {
    const result = drawTrendsEstimationLine({
      svg: {
        data: [
          {
            color: '#ff0000',
            plots: [{ x: 1, y: 2 }, undefined],
          },
          {
            color: '#00ff00',
            plots: [null, { x: 3, y: 4 }],
          },
        ],
      },
      colors,
      shouldRender: true,
    })

    expect(result).toBe('')
  })
})

describe('drawTrendsLastDatapointLabel', () => {
  it('returns an empty string when no data exists', () => {
    expect(
      drawTrendsLastDatapointLabel({
        svg: {},
        colors,
        compactNumberFormatter,
      }),
    ).toBe('')
  })

  it('draws last datapoint labels from svg data', () => {
    const result = drawTrendsLastDatapointLabel({
      svg: {
        data: [
          {
            plots: [{ x: 1, y: 2, value: 1200 }],
          },
        ],
      },
      colors,
      compactNumberFormatter,
    })

    expect(result).toContain('1.2K')
    expect(result).toContain('x="13"')
  })

  it('draws last datapoint labels and falls back to zero for non-finite values', () => {
    const result = drawTrendsLastDatapointLabel({
      svg: {
        series: [
          {
            plots: [{ x: 1, y: 2, value: 1200 }],
          },
          {
            plots: [{ x: 3, y: 4, value: Number.NaN }],
          },
          {
            plots: [],
          },
        ],
      },
      colors,
      compactNumberFormatter,
    })

    expect(result).toContain('1.2K')
    expect(result).toContain('0')
    expect(result).toContain('x="13"')
  })
})

describe('drawTrendsSvgPrintLegend', () => {
  it('returns an empty string when no data exists', () => {
    expect(
      drawTrendsSvgPrintLegend({
        svg: {},
        colors,
        showEstimationLegend: false,
        estimationLabel: 'Estimated',
      }),
    ).toBe('')

    expect(
      drawTrendsSvgPrintLegend({
        svg: {
          data: [],
          series: [
            {
              name: 'ignored',
              color: '#000000',
            },
          ],
        },
        colors,
        showEstimationLegend: false,
        estimationLabel: 'Estimated',
      }),
    ).toBe('')
  })

  it('draws the print legend without estimation legend from data', () => {
    const result = drawTrendsSvgPrintLegend({
      svg: {
        drawingArea: {
          left: 10,
          top: 20,
        },
        data: [
          {
            name: 'vue',
            color: '#42b883',
          },
        ],
      },
      colors,
      showEstimationLegend: false,
      estimationLabel: 'Estimated',
    })

    expect(result).toContain('vue')
    expect(result).toContain('fill="#42b883"')
    expect(result).not.toContain('Estimated')
  })

  it('draws the print legend with estimation legend using series fallback', () => {
    const result = drawTrendsSvgPrintLegend({
      svg: {
        drawingArea: {
          left: 10,
          top: 20,
        },
        series: [
          {
            name: 'vue',
            color: '#42b883',
          },
        ],
      },
      colors,
      showEstimationLegend: true,
      estimationLabel: 'Estimated',
    })

    expect(result).toContain('vue')
    expect(result).toContain('Estimated')
    expect(result).toContain('stroke-dasharray="4"')
  })
})

describe('generateWatermarkLogo', () => {
  it('generates an SVG watermark logo', () => {
    const result = generateWatermarkLogo({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      fill: '#123456',
    })

    expect(result).toContain('x="1"')
    expect(result).toContain('y="2"')
    expect(result).toContain('width="3"')
    expect(result).toContain('height="4"')
    expect(result).toContain('fill="#123456"')
  })
})
