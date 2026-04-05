import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createQuadrantDataset, type PackageQuadrantInput } from '~/utils/compare-quadrant-chart'

function getPointById(dataset: ReturnType<typeof createQuadrantDataset>, id: string) {
  const point = dataset.find(packagePoint => packagePoint.id === id)
  expect(point).toBeDefined()
  return point!
}

describe('createQuadrantDataset', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-05T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty array when the input is empty', () => {
    expect(createQuadrantDataset([])).toEqual([])
  })

  it('preserves package identity fields', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'pkg-1',
        license: 'MIT',
        name: 'alpha',
        downloads: 100,
      },
    ]

    const [point] = createQuadrantDataset(input)

    expect(point).toBeDefined()
    expect(point!.id).toBe('pkg-1')
    expect(point!.license).toBe('MIT')
    expect(point!.name).toBe('alpha')
  })

  it('uses safe defaults for nullable and missing numeric and boolean values', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'pkg-1',
        license: 'MIT',
        name: 'alpha',
        downloads: null,
        totalLikes: undefined,
        packageSize: null,
        installSize: undefined,
        dependencies: null,
        totalDependencies: undefined,
        vulnerabilities: null,
        deprecated: null,
        types: null,
        lastUpdated: null,
      },
      {
        id: 'pkg-2',
        license: 'Apache-2.0',
        name: 'beta',
        downloads: 10,
        totalLikes: 5,
        packageSize: 20,
        installSize: 30,
        dependencies: 2,
        totalDependencies: 4,
        vulnerabilities: 1,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const [point] = createQuadrantDataset(input)

    expect(point).toBeDefined()
    expect(point!.metrics.downloads).toBe(0)
    expect(point!.metrics.totalLikes).toBe(0)
    expect(point!.metrics.packageSize).toBe(0)
    expect(point!.metrics.installSize).toBe(0)
    expect(point!.metrics.dependencies).toBe(0)
    expect(point!.metrics.totalDependencies).toBe(0)
    expect(point!.metrics.vulnerabilities).toBe(0)
    expect(point!.metrics.deprecated).toBe(false)
    expect(point!.metrics.types).toBe(false)
    expect(point!.metrics.freshnessScore).toBe(-1)
    expect(point!.metrics.freshnessPercent).toBe(0)
  })

  it('treats non-finite numeric values as zero', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'pkg-1',
        license: 'MIT',
        name: 'alpha',
        downloads: Number.NaN,
        totalLikes: Number.POSITIVE_INFINITY,
        packageSize: Number.NEGATIVE_INFINITY,
      },
      {
        id: 'pkg-2',
        license: 'MIT',
        name: 'beta',
        downloads: 100,
        totalLikes: 10,
        packageSize: 50,
      },
    ]

    const [point] = createQuadrantDataset(input)

    expect(point).toBeDefined()
    expect(point!.metrics.downloads).toBe(0)
    expect(point!.metrics.totalLikes).toBe(0)
    expect(point!.metrics.packageSize).toBe(0)
  })

  it('computes freshness score and percentage from an ISO date string', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'fresh',
        license: 'MIT',
        name: 'fresh',
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'old',
        license: 'MIT',
        name: 'old',
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const freshPoint = getPointById(dataset, 'fresh')
    const oldPoint = getPointById(dataset, 'old')

    expect(freshPoint.metrics.freshnessScore).toBe(1)
    expect(freshPoint.metrics.freshnessPercent).toBe(100)

    expect(oldPoint.metrics.freshnessScore).toBe(-1)
    expect(oldPoint.metrics.freshnessPercent).toBe(0)
  })

  it('computes freshness from a Date instance', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'fresh',
        license: 'MIT',
        name: 'fresh',
        lastUpdated: new Date('2026-04-05T12:00:00.000Z'),
      },
      {
        id: 'reference',
        license: 'MIT',
        name: 'reference',
        lastUpdated: new Date('2025-10-05T12:00:00.000Z'),
      },
    ]

    const [point] = createQuadrantDataset(input)

    expect(point).toBeDefined()
    expect(point!.metrics.freshnessScore).toBe(1)
    expect(point!.metrics.freshnessPercent).toBe(100)
  })

  it('returns missing freshness values as score -1 and percent 0 for invalid dates', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'invalid',
        license: 'MIT',
        name: 'invalid',
        lastUpdated: 'not-a-date',
      },
      {
        id: 'valid',
        license: 'MIT',
        name: 'valid',
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const invalidPoint = getPointById(dataset, 'invalid')

    expect(invalidPoint.metrics.freshnessScore).toBe(-1)
    expect(invalidPoint.metrics.freshnessPercent).toBe(0)
  })

  it('forces efficiencyScore to -1 when a package is deprecated', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'deprecated-package',
        license: 'MIT',
        name: 'deprecated-package',
        downloads: 1_000_000,
        totalLikes: 500,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: true,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'healthy-package',
        license: 'MIT',
        name: 'healthy-package',
        downloads: 10,
        totalLikes: 0,
        packageSize: 10_000,
        installSize: 10_000,
        dependencies: 100,
        totalDependencies: 1_000,
        vulnerabilities: 10,
        deprecated: false,
        types: false,
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const deprecatedPoint = getPointById(dataset, 'deprecated-package')

    expect(deprecatedPoint.metrics.deprecated).toBe(true)
    expect(deprecatedPoint.efficiencyScore).toBe(-1)
    expect(deprecatedPoint.y).toBe(-1)
    expect(deprecatedPoint.quadrant).toMatch(/BOTTOM_/)
  })

  it('rewards typed packages over untyped packages when other metrics are equal', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'typed',
        license: 'MIT',
        name: 'typed',
        downloads: 100,
        totalLikes: 10,
        packageSize: 50,
        installSize: 75,
        dependencies: 5,
        totalDependencies: 10,
        vulnerabilities: 1,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'untyped',
        license: 'MIT',
        name: 'untyped',
        downloads: 100,
        totalLikes: 10,
        packageSize: 50,
        installSize: 75,
        dependencies: 5,
        totalDependencies: 10,
        vulnerabilities: 1,
        deprecated: false,
        types: false,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const typedPoint = getPointById(dataset, 'typed')
    const untypedPoint = getPointById(dataset, 'untyped')

    expect(typedPoint.efficiencyScore).toBeGreaterThan(untypedPoint.efficiencyScore)
  })

  it('penalises vulnerabilities more aggressively as they increase', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'secure',
        license: 'MIT',
        name: 'secure',
        downloads: 100,
        totalLikes: 10,
        packageSize: 50,
        installSize: 50,
        dependencies: 5,
        totalDependencies: 10,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'vulnerable',
        license: 'MIT',
        name: 'vulnerable',
        downloads: 100,
        totalLikes: 10,
        packageSize: 50,
        installSize: 50,
        dependencies: 5,
        totalDependencies: 10,
        vulnerabilities: 10,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const securePoint = getPointById(dataset, 'secure')
    const vulnerablePoint = getPointById(dataset, 'vulnerable')

    expect(securePoint.efficiencyScore).toBeGreaterThan(vulnerablePoint.efficiencyScore)
  })

  it('assigns TOP_RIGHT when adoptionScore and efficiencyScore are both non-negative', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'best',
        license: 'MIT',
        name: 'best',
        downloads: 100_000_000,
        totalLikes: 1_000,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'worst',
        license: 'MIT',
        name: 'worst',
        downloads: 1,
        totalLikes: 0,
        packageSize: 15_000_000,
        installSize: 25_000_000,
        dependencies: 100,
        totalDependencies: 1_000,
        vulnerabilities: 10,
        deprecated: false,
        types: false,
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const point = getPointById(dataset, 'best')

    expect(point.adoptionScore).toBeGreaterThanOrEqual(0)
    expect(point.efficiencyScore).toBeGreaterThanOrEqual(0)
    expect(point.quadrant).toBe('TOP_RIGHT')
    expect(point.x).toBe(point.adoptionScore)
    expect(point.y).toBe(point.efficiencyScore)
  })

  it('assigns TOP_LEFT when adoptionScore is negative and efficiencyScore is non-negative', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'efficient-but-unadopted',
        license: 'MIT',
        name: 'efficient-but-unadopted',
        downloads: 1,
        totalLikes: 0,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'popular-and-heavy',
        license: 'MIT',
        name: 'popular-and-heavy',
        downloads: 100_000_000,
        totalLikes: 1_000,
        packageSize: 15_000_000,
        installSize: 25_000_000,
        dependencies: 100,
        totalDependencies: 1_000,
        vulnerabilities: 10,
        deprecated: false,
        types: false,
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const point = getPointById(dataset, 'efficient-but-unadopted')

    expect(point.adoptionScore).toBeLessThan(0)
    expect(point.efficiencyScore).toBeGreaterThanOrEqual(0)
    expect(point.quadrant).toBe('TOP_LEFT')
  })

  it('assigns BOTTOM_RIGHT when adoptionScore is non-negative and efficiencyScore is negative', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'popular-but-inefficient',
        license: 'MIT',
        name: 'popular-but-inefficient',
        downloads: 100_000_000,
        totalLikes: 1_000,
        packageSize: 15_000_000,
        installSize: 25_000_000,
        dependencies: 100,
        totalDependencies: 1_000,
        vulnerabilities: 10,
        deprecated: false,
        types: false,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'niche-but-efficient',
        license: 'MIT',
        name: 'niche-but-efficient',
        downloads: 1,
        totalLikes: 0,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const point = getPointById(dataset, 'popular-but-inefficient')

    expect(point.adoptionScore).toBeGreaterThanOrEqual(0)
    expect(point.efficiencyScore).toBeLessThan(0)
    expect(point.quadrant).toBe('BOTTOM_RIGHT')
  })

  it('assigns BOTTOM_LEFT when adoptionScore and efficiencyScore are both negative', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'worst',
        license: 'MIT',
        name: 'worst',
        downloads: 1,
        totalLikes: 0,
        packageSize: 15_000_000,
        installSize: 25_000_000,
        dependencies: 100,
        totalDependencies: 1_000,
        vulnerabilities: 10,
        deprecated: false,
        types: false,
        lastUpdated: '2025-04-05T12:00:00.000Z',
      },
      {
        id: 'best',
        license: 'MIT',
        name: 'best',
        downloads: 100_000_000,
        totalLikes: 1_000,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const point = getPointById(dataset, 'worst')

    expect(point.adoptionScore).toBeLessThan(0)
    expect(point.efficiencyScore).toBeLessThan(0)
    expect(point.quadrant).toBe('BOTTOM_LEFT')
  })

  it('uses logarithmic normalization so larger download counts still improve adoption score across orders of magnitude', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'small',
        license: 'MIT',
        name: 'small',
        downloads: 10,
        totalLikes: 0,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'medium',
        license: 'MIT',
        name: 'medium',
        downloads: 1_000,
        totalLikes: 0,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'large',
        license: 'MIT',
        name: 'large',
        downloads: 1_000_000,
        totalLikes: 0,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const small = getPointById(dataset, 'small')
    const medium = getPointById(dataset, 'medium')
    const large = getPointById(dataset, 'large')

    expect(small.adoptionScore).toBeLessThan(medium.adoptionScore)
    expect(medium.adoptionScore).toBeLessThan(large.adoptionScore)
  })

  it('penalises larger install sizes when other efficiency metrics are equal', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'small-install',
        license: 'MIT',
        name: 'small-install',
        downloads: 1_000,
        totalLikes: 10,
        packageSize: 10_000,
        installSize: 50_000,
        dependencies: 10,
        totalDependencies: 50,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'large-install',
        license: 'MIT',
        name: 'large-install',
        downloads: 1_000,
        totalLikes: 10,
        packageSize: 10_000,
        installSize: 10_000_000,
        dependencies: 10,
        totalDependencies: 50,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)
    const smallInstall = getPointById(dataset, 'small-install')
    const largeInstall = getPointById(dataset, 'large-install')

    expect(smallInstall.efficiencyScore).toBeGreaterThan(largeInstall.efficiencyScore)
  })

  it('returns one point per input package and keeps the input order', () => {
    const input: PackageQuadrantInput[] = [
      { id: 'one', license: 'MIT', name: 'one', downloads: 1 },
      { id: 'two', license: 'MIT', name: 'two', downloads: 2 },
      { id: 'three', license: 'MIT', name: 'three', downloads: 3 },
    ]

    const dataset = createQuadrantDataset(input)

    expect(dataset).toHaveLength(3)
    expect(dataset.map(point => point.id)).toEqual(['one', 'two', 'three'])
  })

  it('clamps scores to the [-1, 1] range', () => {
    const input: PackageQuadrantInput[] = [
      {
        id: 'extreme-best',
        license: 'MIT',
        name: 'extreme-best',
        downloads: 10_000_000_000,
        totalLikes: 10_000,
        packageSize: 1,
        installSize: 1,
        dependencies: 0,
        totalDependencies: 0,
        vulnerabilities: 0,
        deprecated: false,
        types: true,
        lastUpdated: '2026-04-05T12:00:00.000Z',
      },
      {
        id: 'extreme-worst',
        license: 'MIT',
        name: 'extreme-worst',
        downloads: 0,
        totalLikes: 0,
        packageSize: 100_000_000,
        installSize: 100_000_000,
        dependencies: 10_000,
        totalDependencies: 20_000,
        vulnerabilities: 10_000,
        deprecated: false,
        types: false,
        lastUpdated: '2024-04-05T12:00:00.000Z',
      },
    ]

    const dataset = createQuadrantDataset(input)

    for (const point of dataset) {
      expect(point.adoptionScore).toBeGreaterThanOrEqual(-1)
      expect(point.adoptionScore).toBeLessThanOrEqual(1)
      expect(point.efficiencyScore).toBeGreaterThanOrEqual(-1)
      expect(point.efficiencyScore).toBeLessThanOrEqual(1)
      expect(point.x).toBeGreaterThanOrEqual(-1)
      expect(point.x).toBeLessThanOrEqual(1)
      expect(point.y).toBeGreaterThanOrEqual(-1)
      expect(point.y).toBeLessThanOrEqual(1)
    }
  })
})
