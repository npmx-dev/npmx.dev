import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDownloadsSvgResponse } from '../../../../server/utils/embed-downloads-svg'

const mocks = vi.hoisted(() => ({
  fetchDownloadsEvolution: vi.fn(),
  buildTrendsChartData: vi.fn(),
  buildNormalisedTrendsDataset: vi.fn(),
  buildTrendsChartConfig: vi.fn(),
  resolveEmbedChartColors: vi.fn(),
  mergeConfigs: vi.fn(),
  createStaticVueUiXy: vi.fn(),
  generateWatermarkLogo: vi.fn(),
  isLastDayOfMonth: vi.fn(),
  getEffectiveEndDateIso: vi.fn(),
  isLastDayOfYear: vi.fn(),
}))

vi.mock('#server/utils/download-evolution', () => ({
  fetchDownloadsEvolution: mocks.fetchDownloadsEvolution,
}))

vi.mock('#shared/utils/trends-chart', () => ({
  buildTrendsChartData: mocks.buildTrendsChartData,
  buildNormalisedTrendsDataset: mocks.buildNormalisedTrendsDataset,
  buildTrendsChartConfig: mocks.buildTrendsChartConfig,
  generateWatermarkLogo: mocks.generateWatermarkLogo,
}))

vi.mock('#shared/utils/embed-chart-colors', () => ({
  resolveEmbedChartColors: mocks.resolveEmbedChartColors,
}))

vi.mock('vue-data-ui/utils', () => ({
  mergeConfigs: mocks.mergeConfigs,
}))

vi.mock('vue-data-ui/ssr/vue-ui-xy', () => ({
  createStaticVueUiXy: mocks.createStaticVueUiXy,
}))

vi.mock('~/utils/date', () => ({
  getEffectiveEndDateIso: mocks.getEffectiveEndDateIso,
  isLastDayOfMonth: mocks.isLastDayOfMonth,
  isLastDayOfYear: mocks.isLastDayOfYear,
}))

vi.mock('~/utils/colors', () => ({
  OKLCH_NEUTRAL_FALLBACK: 'oklch-neutral-fallback',
}))

function createEvolution(packageName: string) {
  return [
    {
      period: '2026-05-01',
      downloads: packageName.length * 100,
    },
  ]
}

function createDataset(overrides: Record<string, unknown> = {}) {
  return [
    {
      name: 'vue',
      series: [10, 20],
      dashIndices: undefined,
      ...overrides,
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()

  mocks.fetchDownloadsEvolution.mockImplementation(async (packageName: string) =>
    createEvolution(packageName),
  )

  mocks.resolveEmbedChartColors.mockReturnValue({
    fg: '#111111',
    bg: '#ffffff',
    fgMuted: '#666666',
    fgSubtle: '#999999',
  })

  mocks.buildTrendsChartData.mockReturnValue({
    dates: ['2026-05-01', '2026-05-02'],
    dataset: createDataset(),
  })

  mocks.buildNormalisedTrendsDataset.mockReturnValue(createDataset())

  mocks.buildTrendsChartConfig.mockReturnValue({
    chart: {
      base: true,
    },
  })

  mocks.mergeConfigs.mockImplementation(({ defaultConfig, userConfig }) => ({
    defaultConfig,
    userConfig,
  }))

  mocks.generateWatermarkLogo.mockReturnValue('<g data-logo="true" />')
  mocks.getEffectiveEndDateIso.mockReturnValue('2026-05-31')
  mocks.isLastDayOfMonth.mockReturnValue(true)
  mocks.isLastDayOfYear.mockReturnValue(true)

  mocks.createStaticVueUiXy.mockImplementation(async options => {
    options.additionalSvgContent({
      drawingArea: {
        bottom: 300,
      },
      series: [
        {
          plots: [
            {
              x: 100,
              y: 50,
              value: 1200,
            },
          ],
        },
        {
          plots: [],
        },
      ],
    })

    return '<svg />'
  })
})

describe('downloads SVG embed response', () => {
  it('throws 400 when no valid package name is provided', async () => {
    await expect(createDownloadsSvgResponse({})).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing package name. Use ?package=nuxt or ?packages=vite,rolldown',
    })
  })

  it('throws 501 for likes metric', async () => {
    await expect(
      createDownloadsSvgResponse({
        package: 'vue',
        metric: 'likes',
      }),
    ).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('throws 501 for contributors metric', async () => {
    await expect(
      createDownloadsSvgResponse({
        package: 'vue',
        metric: 'contributors',
      }),
    ).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('renders an SVG response for a single package', async () => {
    const result = await createDownloadsSvgResponse({
      package: 'vue',
    })

    expect(result).toBe('<svg />')
    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith('vue', {
      granularity: 'week',
      weeks: 52,
      months: 12,
      startDate: undefined,
      endDate: undefined,
    })
  })

  it('supports multiple packages from the packages query', async () => {
    await createDownloadsSvgResponse({
      packages: 'Vue, @Nuxt/Kit, invalid package, React',
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledTimes(3)
    expect(mocks.fetchDownloadsEvolution).toHaveBeenNthCalledWith(1, 'vue', expect.any(Object))
    expect(mocks.fetchDownloadsEvolution).toHaveBeenNthCalledWith(
      2,
      '@nuxt/kit',
      expect.any(Object),
    )
    expect(mocks.fetchDownloadsEvolution).toHaveBeenNthCalledWith(3, 'react', expect.any(Object))

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        packageNames: ['vue', '@nuxt/kit', 'react'],
        isMultiPackageMode: true,
      }),
    )
  })

  it('limits package names to 8 entries', async () => {
    await createDownloadsSvgResponse({
      packages: 'a,b,c,d,e,f,g,h,i,j',
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledTimes(8)
  })

  it.each([
    ['daily', 'day', 'daily'],
    ['day', 'day', 'daily'],
    ['weekly', 'week', 'weekly'],
    ['week', 'week', 'weekly'],
    ['monthly', 'month', 'monthly'],
    ['month', 'month', 'monthly'],
    ['yearly', 'year', 'yearly'],
    ['year', 'year', 'yearly'],
  ])('parses granularity %s', async (queryGranularity, fetchGranularity, chartGranularity) => {
    await createDownloadsSvgResponse({
      package: 'vue',
      granularity: queryGranularity,
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        granularity: fetchGranularity,
      }),
    )

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedGranularity: chartGranularity,
        displayedGranularity: chartGranularity,
      }),
    )
  })

  it('clamps width, height, weeks, and months', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      width: 99999,
      height: 1,
      weeks: 99999,
      months: 0,
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        weeks: 260,
        months: 1,
      }),
    )

    expect(mocks.mergeConfigs).toHaveBeenCalledWith(
      expect.objectContaining({
        userConfig: expect.objectContaining({
          chart: expect.objectContaining({
            width: 1600,
            height: 240,
          }),
        }),
      }),
    )
  })

  it('uses fallback dimensions and periods for invalid numeric query values', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      width: 'nope',
      height: 'nope',
      weeks: 'nope',
      months: 'nope',
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        weeks: 52,
        months: 12,
      }),
    )

    expect(mocks.mergeConfigs).toHaveBeenCalledWith(
      expect.objectContaining({
        userConfig: expect.objectContaining({
          chart: expect.objectContaining({
            width: 900,
            height: 420,
          }),
        }),
      }),
    )
  })

  it('parses valid dates and ignores invalid dates', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      start: 'invalid',
      endDate: '2026-05-31',
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        startDate: undefined,
        endDate: '2026-05-31',
      }),
    )
  })

  it('uses startDate and end aliases', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      startDate: '2026-01-01',
      end: '2026-05-31',
    })

    expect(mocks.fetchDownloadsEvolution).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-05-31',
      }),
    )
  })

  it('uses dark colors when mode is dark', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      mode: 'dark',
    })

    expect(mocks.resolveEmbedChartColors).toHaveBeenCalledWith('dark')
  })

  it('uses light colors by default', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    expect(mocks.resolveEmbedChartColors).toHaveBeenCalledWith('light')
  })

  it('uses a valid locale', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      locale: 'fr-FR',
    })

    const chartDataOptions = mocks.buildTrendsChartData.mock.calls[0]![0]
    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('fr-FR')
  })

  it('falls back to en for invalid locale', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      locale: 'not a locale',
    })

    const chartDataOptions = mocks.buildTrendsChartData.mock.calls[0]![0]
    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('en')
  })

  it('uses an identity translation function for chart data', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const chartDataOptions = mocks.buildTrendsChartData.mock.calls[0]![0]

    expect(chartDataOptions.t('downloads')).toBe('downloads')
  })

  it('sanitizes yLabel', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      yLabel: '<Downloads>&"`\u0000',
    })

    const userConfig = mocks.mergeConfigs.mock.calls[0]![0].userConfig
    expect(userConfig.chart.grid.labels.axis.yLabel).toBe('Downloads')
  })

  it('uses fallback yLabel for non-string values', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      yLabel: 123,
    })

    const userConfig = mocks.mergeConfigs.mock.calls[0]![0].userConfig
    expect(userConfig.chart.grid.labels.axis.yLabel).toBe('')
  })

  it('accepts hex accent colors', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      accent: '#abc',
    })

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: '#abc',
      }),
    )
  })

  it('accepts oklch accent colors', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      accent: 'oklch(0.787 0.128 230.318)',
    })

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch(0.787 0.128 230.318)',
      }),
    )
  })

  it('falls back for invalid accent colors', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      accent: 'red',
    })

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch-neutral-fallback',
      }),
    )
  })

  it('falls back for non-string accent colors', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
      accent: 42,
    })

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch-neutral-fallback',
      }),
    )
  })

  it('throws 404 when chart dataset is empty', async () => {
    mocks.buildTrendsChartData.mockReturnValue({
      dates: [],
      dataset: [],
    })

    await expect(
      createDownloadsSvgResponse({
        package: 'vue',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'No chart dataset generated',
    })
  })

  it('throws 404 when normalized dataset is empty', async () => {
    mocks.buildNormalisedTrendsDataset.mockReturnValue([])

    await expect(
      createDownloadsSvgResponse({
        package: 'vue',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'No normalized dataset generated',
    })
  })

  it('adds a dash index to the last monthly point when the effective end date is not the last day of month', async () => {
    mocks.isLastDayOfMonth.mockReturnValue(false)
    mocks.getEffectiveEndDateIso.mockReturnValue('2026-05-12')
    mocks.buildNormalisedTrendsDataset.mockReturnValue([
      {
        name: 'vue',
        series: [10, 20, 30],
        dashIndices: [0, 2],
      },
    ])

    await createDownloadsSvgResponse({
      package: 'vue',
      granularity: 'month',
      endDate: '2026-05-12',
    })

    expect(mocks.createStaticVueUiXy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: [
          expect.objectContaining({
            dashIndices: [0, 2],
          }),
        ],
      }),
    )
  })

  it('filters negative dash index for empty monthly series', async () => {
    mocks.isLastDayOfMonth.mockReturnValue(false)
    mocks.buildNormalisedTrendsDataset.mockReturnValue([
      {
        name: 'vue',
        series: [],
      },
    ])

    await createDownloadsSvgResponse({
      package: 'vue',
      granularity: 'month',
    })

    expect(mocks.createStaticVueUiXy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: [
          expect.objectContaining({
            dashIndices: [],
          }),
        ],
      }),
    )
  })

  it('keeps dash indices unchanged outside incomplete monthly data', async () => {
    mocks.buildNormalisedTrendsDataset.mockReturnValue([
      {
        name: 'vue',
        series: [10, 20],
        dashIndices: [1],
      },
    ])

    await createDownloadsSvgResponse({
      package: 'vue',
    })

    expect(mocks.createStaticVueUiXy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: [
          expect.objectContaining({
            dashIndices: [1],
          }),
        ],
      }),
    )
  })

  it('generates extra SVG labels and watermark content', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const options = mocks.createStaticVueUiXy.mock.calls[0]![0]
    const content = options.additionalSvgContent({
      drawingArea: {
        bottom: 300,
      },
      series: [
        {
          plots: [
            {
              x: 100,
              y: 50,
              value: 1200,
            },
          ],
        },
        {
          plots: [],
        },
      ],
    })

    expect(content).toContain('<text')
    expect(content).toContain('1.2K')
    expect(content).toContain('<g data-logo="true" />')
    expect(mocks.generateWatermarkLogo).toHaveBeenCalledWith({
      x: 12,
      y: 360,
      width: 80,
      height: 30,
      fill: '#999999',
    })
  })

  it('falls back to an empty singleEvolution when the first package has no evolution', async () => {
    mocks.fetchDownloadsEvolution.mockImplementation(async (packageName: string) => {
      if (packageName === 'vue') {
        return undefined
      }

      return createEvolution(packageName)
    })

    await createDownloadsSvgResponse({
      package: 'vue',
    })

    expect(mocks.buildTrendsChartData).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvolution: [],
      }),
    )

    expect(mocks.buildTrendsChartConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvolution: [],
      }),
    )
  })

  it('uses an identity translation function for chart config', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const chartConfigOptions = mocks.buildTrendsChartConfig.mock.calls[0]![0]

    expect(chartConfigOptions.t('downloads')).toBe('downloads')
  })

  it('formats the last plot value in additionalSvgContent', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const options = mocks.createStaticVueUiXy.mock.calls[0]![0]

    const content = options.additionalSvgContent({
      drawingArea: {
        bottom: 300,
      },
      series: [
        {
          plots: [
            {
              x: 10,
              y: 20,
              value: 1234,
            },
          ],
        },
      ],
    })

    expect(content).toContain('1.2K')
  })

  it('falls back to 0 when the last plot value is missing', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const options = mocks.createStaticVueUiXy.mock.calls[0]![0]

    const content = options.additionalSvgContent({
      drawingArea: {
        bottom: 300,
      },
      series: [
        {
          plots: [
            {
              x: 10,
              y: 20,
              value: undefined,
            },
          ],
        },
      ],
    })

    expect(content).toContain('0')
  })

  it('falls back to en when canonical locales returns an empty array', async () => {
    const spy = vi.spyOn(Intl, 'getCanonicalLocales').mockReturnValue([])

    await createDownloadsSvgResponse({
      package: 'vue',
      locale: 'fr',
    })

    const chartDataOptions = mocks.buildTrendsChartData.mock.calls[0]![0]

    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('en')

    spy.mockRestore()
  })

  it('handles series without plots', async () => {
    await createDownloadsSvgResponse({
      package: 'vue',
    })

    const options = mocks.createStaticVueUiXy.mock.calls[0]![0]

    const content = options.additionalSvgContent({
      drawingArea: {
        bottom: 300,
      },
      series: [
        {
          plots: undefined,
        },
      ],
    })

    expect(content).toContain('<g data-logo="true" />')
    expect(content).not.toContain('<text')
  })
})
