import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError, type H3Event } from 'h3'

const fetchDownloadsEvolutionMock = vi.fn()
const buildTrendsChartDataMock = vi.fn()
const buildNormalisedTrendsDatasetMock = vi.fn()
const buildTrendsChartConfigMock = vi.fn()
const resolveEmbedChartColorsMock = vi.fn()
const mergeConfigsMock = vi.fn()
const createStaticVueUiXyMock = vi.fn()
const generateWatermarkLogoMock = vi.fn()
const isLastDayOfMonthMock = vi.fn()
const getEffectiveEndDateIsoMock = vi.fn()

vi.mock('#server/utils/download-evolution', () => ({
  fetchDownloadsEvolution: fetchDownloadsEvolutionMock,
}))

vi.mock('#shared/utils/trends-chart', () => ({
  buildTrendsChartData: buildTrendsChartDataMock,
  buildNormalisedTrendsDataset: buildNormalisedTrendsDatasetMock,
  buildTrendsChartConfig: buildTrendsChartConfigMock,
  generateWatermarkLogo: generateWatermarkLogoMock,
}))

vi.mock('#shared/utils/embed-chart-colors', () => ({
  resolveEmbedChartColors: resolveEmbedChartColorsMock,
}))

vi.mock('vue-data-ui/utils', () => ({
  mergeConfigs: mergeConfigsMock,
}))

vi.mock('vue-data-ui/ssr', () => ({
  createStaticVueUiXy: createStaticVueUiXyMock,
}))

vi.mock('~/utils/date', () => ({
  getEffectiveEndDateIso: getEffectiveEndDateIsoMock,
  isLastDayOfMonth: isLastDayOfMonthMock,
}))

vi.mock('~/utils/colors', () => ({
  OKLCH_NEUTRAL_FALLBACK: 'oklch-neutral-fallback',
}))

vi.stubGlobal('defineCachedEventHandler', (handler: Function) => handler)
vi.stubGlobal('createError', createError)

let queryParams: Record<string, unknown> = {}
const setHeaderMock = vi.fn()

vi.stubGlobal('getQuery', () => queryParams)
vi.stubGlobal('setHeader', setHeaderMock)

const handler = (await import('#server/api/embed/downloads.svg/index.get')).default
const event = {} as H3Event

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

  queryParams = {
    package: 'vue',
  }

  fetchDownloadsEvolutionMock.mockImplementation(async (packageName: string) =>
    createEvolution(packageName),
  )

  resolveEmbedChartColorsMock.mockReturnValue({
    fg: '#111111',
    bg: '#ffffff',
    fgMuted: '#666666',
    fgSubtle: '#999999',
  })

  buildTrendsChartDataMock.mockReturnValue({
    dates: ['2026-05-01', '2026-05-02'],
    dataset: createDataset(),
  })

  buildNormalisedTrendsDatasetMock.mockReturnValue(createDataset())

  buildTrendsChartConfigMock.mockReturnValue({
    chart: {
      base: true,
    },
  })

  mergeConfigsMock.mockImplementation(({ defaultConfig, userConfig }) => ({
    defaultConfig,
    userConfig,
  }))

  generateWatermarkLogoMock.mockReturnValue('<g data-logo="true" />')
  getEffectiveEndDateIsoMock.mockReturnValue('2026-05-31')
  isLastDayOfMonthMock.mockReturnValue(true)

  createStaticVueUiXyMock.mockImplementation(async options => {
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

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('downloads SVG embed API', () => {
  it('throws 400 when no valid package name is provided', async () => {
    queryParams = {}

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Missing package name. Use ?package=nuxt or ?packages=vite,rolldown',
    })
  })

  it('throws 501 for likes metric', async () => {
    queryParams = {
      package: 'vue',
      metric: 'likes',
    }

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('throws 501 for contributors metric', async () => {
    queryParams = {
      package: 'vue',
      metric: 'contributors',
    }

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('renders an SVG response for a single package', async () => {
    const result = await handler(event)

    expect(result).toBe('<svg />')
    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith('vue', {
      granularity: 'week',
      weeks: 52,
      months: 12,
      startDate: undefined,
      endDate: undefined,
    })
    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Content-Type',
      'image/svg+xml; charset=utf-8',
    )
    expect(setHeaderMock).toHaveBeenCalledWith(
      event,
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400',
    )
  })

  it('supports multiple packages from the packages query', async () => {
    queryParams = {
      packages: 'Vue, @Nuxt/Kit, invalid package, React',
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledTimes(3)
    expect(fetchDownloadsEvolutionMock).toHaveBeenNthCalledWith(1, 'vue', expect.any(Object))
    expect(fetchDownloadsEvolutionMock).toHaveBeenNthCalledWith(2, '@nuxt/kit', expect.any(Object))
    expect(fetchDownloadsEvolutionMock).toHaveBeenNthCalledWith(3, 'react', expect.any(Object))

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        packageNames: ['vue', '@nuxt/kit', 'react'],
        isMultiPackageMode: true,
      }),
    )
  })

  it('limits package names to 8 entries', async () => {
    queryParams = {
      packages: 'a,b,c,d,e,f,g,h,i,j',
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledTimes(8)
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
    queryParams = {
      package: 'vue',
      granularity: queryGranularity,
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        granularity: fetchGranularity,
      }),
    )
    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedGranularity: chartGranularity,
        displayedGranularity: chartGranularity,
      }),
    )
  })

  it('clamps width, height, weeks, and months', async () => {
    queryParams = {
      package: 'vue',
      width: 99999,
      height: 1,
      weeks: 99999,
      months: 0,
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        weeks: 260,
        months: 1,
      }),
    )

    expect(mergeConfigsMock).toHaveBeenCalledWith(
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
    queryParams = {
      package: 'vue',
      width: 'nope',
      height: 'nope',
      weeks: 'nope',
      months: 'nope',
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        weeks: 52,
        months: 12,
      }),
    )

    expect(mergeConfigsMock).toHaveBeenCalledWith(
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
    queryParams = {
      package: 'vue',
      start: 'invalid',
      endDate: '2026-05-31',
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        startDate: undefined,
        endDate: '2026-05-31',
      }),
    )
  })

  it('uses startDate and end aliases', async () => {
    queryParams = {
      package: 'vue',
      startDate: '2026-01-01',
      end: '2026-05-31',
    }

    await handler(event)

    expect(fetchDownloadsEvolutionMock).toHaveBeenCalledWith(
      'vue',
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-05-31',
      }),
    )
  })

  it('uses dark colors when mode is dark', async () => {
    queryParams = {
      package: 'vue',
      mode: 'dark',
    }

    await handler(event)

    expect(resolveEmbedChartColorsMock).toHaveBeenCalledWith('dark')
  })

  it('uses light colors by default', async () => {
    await handler(event)

    expect(resolveEmbedChartColorsMock).toHaveBeenCalledWith('light')
  })

  it('uses a valid locale', async () => {
    queryParams = {
      package: 'vue',
      locale: 'fr-FR',
    }

    await handler(event)

    const chartDataOptions = buildTrendsChartDataMock.mock.calls[0]![0]
    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('fr-FR')
  })

  it('falls back to en for invalid locale', async () => {
    queryParams = {
      package: 'vue',
      locale: 'not a locale',
    }

    await handler(event)

    const chartDataOptions = buildTrendsChartDataMock.mock.calls[0]![0]
    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('en')
  })

  it('sanitizes yLabel', async () => {
    queryParams = {
      package: 'vue',
      yLabel: '<Downloads>&"`\u0000',
    }

    await handler(event)

    const userConfig = mergeConfigsMock.mock.calls[0]![0].userConfig
    expect(userConfig.chart.grid.labels.axis.yLabel).toBe('Downloads')
  })

  it('uses fallback yLabel for non-string values', async () => {
    queryParams = {
      package: 'vue',
      yLabel: 123,
    }

    await handler(event)

    const userConfig = mergeConfigsMock.mock.calls[0]![0].userConfig
    expect(userConfig.chart.grid.labels.axis.yLabel).toBe('')
  })

  it('accepts hex accent colors', async () => {
    queryParams = {
      package: 'vue',
      accent: '#abc',
    }

    await handler(event)

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: '#abc',
      }),
    )
  })

  it('accepts oklch accent colors', async () => {
    queryParams = {
      package: 'vue',
      accent: 'oklch(0.787 0.128 230.318)',
    }

    await handler(event)

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch(0.787 0.128 230.318)',
      }),
    )
  })

  it('falls back for invalid accent colors', async () => {
    queryParams = {
      package: 'vue',
      accent: 'red',
    }

    await handler(event)

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch-neutral-fallback',
      }),
    )
  })

  it('falls back for non-string accent colors', async () => {
    queryParams = {
      package: 'vue',
      accent: 42,
    }

    await handler(event)

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accent: 'oklch-neutral-fallback',
      }),
    )
  })

  it('throws 404 when chart dataset is empty', async () => {
    buildTrendsChartDataMock.mockReturnValue({
      dates: [],
      dataset: [],
    })

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'No chart dataset generated',
    })
  })

  it('throws 404 when normalized dataset is empty', async () => {
    buildNormalisedTrendsDatasetMock.mockReturnValue([])

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 404,
      statusMessage: 'No normalized dataset generated',
    })
  })

  it('adds a dash index to the last monthly point when the effective end date is not the last day of month', async () => {
    queryParams = {
      package: 'vue',
      granularity: 'month',
      endDate: '2026-05-12',
    }

    isLastDayOfMonthMock.mockReturnValue(false)
    getEffectiveEndDateIsoMock.mockReturnValue('2026-05-12')
    buildNormalisedTrendsDatasetMock.mockReturnValue([
      {
        name: 'vue',
        series: [10, 20, 30],
        dashIndices: [0, 2],
      },
    ])

    await handler(event)

    expect(createStaticVueUiXyMock).toHaveBeenCalledWith(
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
    queryParams = {
      package: 'vue',
      granularity: 'month',
    }

    isLastDayOfMonthMock.mockReturnValue(false)
    buildNormalisedTrendsDatasetMock.mockReturnValue([
      {
        name: 'vue',
        series: [],
      },
    ])

    await handler(event)

    expect(createStaticVueUiXyMock).toHaveBeenCalledWith(
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
    buildNormalisedTrendsDatasetMock.mockReturnValue([
      {
        name: 'vue',
        series: [10, 20],
        dashIndices: [1],
      },
    ])

    await handler(event)

    expect(createStaticVueUiXyMock).toHaveBeenCalledWith(
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
    await handler(event)

    const options = createStaticVueUiXyMock.mock.calls[0]![0]
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
    expect(generateWatermarkLogoMock).toHaveBeenCalledWith({
      x: 12,
      y: 360,
      width: 80,
      height: 30,
      fill: '#999999',
    })
  })

  it('falls back to an empty singleEvolution when the first package has no evolution', async () => {
    fetchDownloadsEvolutionMock.mockImplementation(async (packageName: string) => {
      if (packageName === 'vue') {
        return undefined
      }

      return createEvolution(packageName)
    })

    await handler(event)

    expect(buildTrendsChartDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvolution: [],
      }),
    )

    expect(buildTrendsChartConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        singleEvolution: [],
      }),
    )
  })

  it('formats the last plot value in additionalSvgContent', async () => {
    await handler(event)

    const options = createStaticVueUiXyMock.mock.calls[0]![0]

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
    await handler(event)

    const options = createStaticVueUiXyMock.mock.calls[0]![0]

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

    queryParams = {
      package: 'vue',
      locale: 'fr',
    }

    await handler(event)

    const chartDataOptions = buildTrendsChartDataMock.mock.calls[0]![0]

    expect(chartDataOptions.compactNumberFormatter.resolvedOptions().locale).toBe('en')

    spy.mockRestore()
  })
})
