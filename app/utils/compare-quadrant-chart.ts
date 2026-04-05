export interface PackageQuadrantInput {
  id: string
  license: string
  name: string
  downloads?: number | null
  totalLikes?: number | null
  packageSize?: number | null
  installSize?: number | null
  dependencies?: number | null
  totalDependencies?: number | null
  vulnerabilities?: number | null
  deprecated?: boolean | null
  types?: boolean | null
  lastUpdated?: string | Date | null
}

export interface PackageQuadrantPoint {
  id: string
  license: string
  name: string
  x: number
  y: number
  adoptionScore: number
  efficiencyScore: number
  quadrant: 'TOP_RIGHT' | 'TOP_LEFT' | 'BOTTOM_RIGHT' | 'BOTTOM_LEFT'
  metrics: {
    downloads: number
    totalLikes: number
    packageSize: number
    installSize: number
    dependencies: number
    totalDependencies: number
    vulnerabilities: number
    deprecated: boolean
    types: boolean
    freshnessScore: number
    freshnessPercent: number
  }
}

interface QuadrantMetricRanges {
  minimumDownloads: number
  maximumDownloads: number
  minimumTotalLikes: number
  maximumTotalLikes: number
  minimumPackageSize: number
  maximumPackageSize: number
  minimumInstallSize: number
  maximumInstallSize: number
  minimumDependencies: number
  maximumDependencies: number
  minimumTotalDependencies: number
  maximumTotalDependencies: number
  minimumVulnerabilities: number
  maximumVulnerabilities: number
  minimumLogarithmicDownloads: number
  maximumLogarithmicDownloads: number
}

const WEIGHTS = {
  // Quadrant X axis
  adoption: {
    downloads: 0.7, // dominant signal because they best reflect real-world adoption
    freshness: 0.1, // small correction so stale packages are slightly penalized
    likes: 0.01, // might be pumped up in the future when ./npmx likes are more mainstream
  },
  // Quadrant Y axis
  efficiency: {
    installSize: 0.3, // weighted highest because it best reflects consumer footprint
    dependencies: 0.2, // direct deps capture architectural and supply-chain complexity
    totalDependencies: 0.15, // same for total deps
    packageSize: 0.1, // publication weight, less important than installed footprint
    vulnerabilities: 0.2, // penalize security burden
    types: 0.1, // TS support
    deprecation: 0.05
  }
}
const VULNERABILITY_PENALTY_MULTIPLIER = 2

function clampInRange(value: number, min = -1, max = 1): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeNumber(value: number, min: number, max: number): number {
  if (max === min) return 0
  const normalisedValue = (value - min) / (max - min)
  return clampInRange(normalisedValue * 2 - 1)
}

function normalizeInverseNumber(value: number, min: number, max: number): number {
  return -normalizeNumber(value, min, max)
}

function normalizeBoolean(value: boolean): number {
  return value ? 1 : -1
}

function toSafeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getnormalisedFreshness(
  value: string | Date | null | undefined,
  maximumAgeInDays = 365,
): number | null {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const now = Date.now()
  const ageInMilliseconds = now - date.getTime()
  const ageInDays = ageInMilliseconds / (1000 * 60 * 60 * 24)

  return 1 - ageInDays / maximumAgeInDays
}

function getFreshnessScore(
  value: string | Date | null | undefined,
  maximumAgeInDays = 365,
): number {
  const normalisedAge = getnormalisedFreshness(value, maximumAgeInDays)
  if (normalisedAge === null) return -1
  return clampInRange(normalisedAge * 2 - 1)
}

function getFreshnessPercentage(
  value: string | Date | null | undefined,
  maximumAgeInDays = 365,
): number {
  const normalisedAge = getnormalisedFreshness(value, maximumAgeInDays)
  if (normalisedAge === null) return 0
  return Math.max(0, Math.min(1, normalisedAge)) * 100
}

function getVulnerabilityPenalty(
  value: number,
  minimum: number,
  maximum: number,
): number {
  const normalised = normalizeInverseNumber(value, minimum, maximum)
  return normalised < 0 ? normalised * VULNERABILITY_PENALTY_MULTIPLIER : normalised
}

function resolveQuadrant(x: number, y: number): PackageQuadrantPoint['quadrant'] {
  if (x >= 0 && y >= 0) return 'TOP_RIGHT'
  if (x < 0 && y >= 0) return 'TOP_LEFT'
  if (x >= 0 && y < 0) return 'BOTTOM_RIGHT'
  return 'BOTTOM_LEFT'
}

function getQuadrantMetricRanges(packages: PackageQuadrantInput[]): QuadrantMetricRanges {
  const downloadsValues = packages.map(packageItem => toSafeNumber(packageItem.downloads))
  const totalLikesValues = packages.map(packageItem => toSafeNumber(packageItem.totalLikes))
  const packageSizeValues = packages.map(packageItem => toSafeNumber(packageItem.packageSize))
  const installSizeValues = packages.map(packageItem => toSafeNumber(packageItem.installSize))
  const dependenciesValues = packages.map(packageItem => toSafeNumber(packageItem.dependencies))
  const totalDependenciesValues = packages.map(packageItem =>
    toSafeNumber(packageItem.totalDependencies),
  )
  const vulnerabilitiesValues = packages.map(packageItem =>
    toSafeNumber(packageItem.vulnerabilities),
  )
  const logarithmicDownloadsValues = downloadsValues.map(value => Math.log(value + 1))

  return {
    minimumDownloads: Math.min(...downloadsValues),
    maximumDownloads: Math.max(...downloadsValues),
    minimumTotalLikes: Math.min(...totalLikesValues),
    maximumTotalLikes: Math.max(...totalLikesValues),
    minimumPackageSize: Math.min(...packageSizeValues),
    maximumPackageSize: Math.max(...packageSizeValues),
    minimumInstallSize: Math.min(...installSizeValues),
    maximumInstallSize: Math.max(...installSizeValues),
    minimumDependencies: Math.min(...dependenciesValues),
    maximumDependencies: Math.max(...dependenciesValues),
    minimumTotalDependencies: Math.min(...totalDependenciesValues),
    maximumTotalDependencies: Math.max(...totalDependenciesValues),
    minimumVulnerabilities: Math.min(...vulnerabilitiesValues),
    maximumVulnerabilities: Math.max(...vulnerabilitiesValues),
    minimumLogarithmicDownloads: Math.min(...logarithmicDownloadsValues),
    maximumLogarithmicDownloads: Math.max(...logarithmicDownloadsValues),
  }
}

function createQuadrantPoint(
  packageItem: PackageQuadrantInput,
  metricRanges: QuadrantMetricRanges,
): PackageQuadrantPoint {
  const downloads = toSafeNumber(packageItem.downloads)
  const totalLikes = toSafeNumber(packageItem.totalLikes)
  const packageSize = toSafeNumber(packageItem.packageSize)
  const installSize = toSafeNumber(packageItem.installSize)
  const dependencies = toSafeNumber(packageItem.dependencies)
  const totalDependencies = toSafeNumber(packageItem.totalDependencies)
  const vulnerabilities = toSafeNumber(packageItem.vulnerabilities)
  const deprecated = packageItem.deprecated ?? false
  const types = packageItem.types ?? false
  const freshnessScore = getFreshnessScore(packageItem.lastUpdated) // for weighing
  const freshnessPercent = getFreshnessPercentage(packageItem.lastUpdated) // for display

  // Since downloads can span multiple orders of magnitude, log is used to normalise them to produce comparable scores instead of collapsing most values into noise
  const normalisedDownloads = normalizeNumber(
    Math.log(downloads + 1),
    metricRanges.minimumLogarithmicDownloads,
    metricRanges.maximumLogarithmicDownloads,
  )

  const normalisedTotalLikes = normalizeNumber(
    totalLikes,
    metricRanges.minimumTotalLikes,
    metricRanges.maximumTotalLikes,
  )

  const normalisedInstallSize = normalizeInverseNumber(
    installSize,
    metricRanges.minimumInstallSize,
    metricRanges.maximumInstallSize,
  )

  const normalisedDependencies = normalizeInverseNumber(
    dependencies,
    metricRanges.minimumDependencies,
    metricRanges.maximumDependencies,
  )

  const normalisedTotalDependencies = normalizeInverseNumber(
    totalDependencies,
    metricRanges.minimumTotalDependencies,
    metricRanges.maximumTotalDependencies,
  )

  const normalisedPackageSize = normalizeInverseNumber(
    packageSize,
    metricRanges.minimumPackageSize,
    metricRanges.maximumPackageSize,
  )

  const normalisedVulnerabilities = getVulnerabilityPenalty(
    vulnerabilities,
    metricRanges.minimumVulnerabilities,
    metricRanges.maximumVulnerabilities,
  )

  const deprecationScore = normalizeBoolean(!deprecated)
  const typesScore = normalizeBoolean(types)

  const adoptionScore = clampInRange(
    normalisedDownloads * WEIGHTS.adoption.downloads +
    freshnessScore * WEIGHTS.adoption.freshness +
    normalisedTotalLikes * WEIGHTS.adoption.likes, 
  )

const rawEfficiencyScore =
  normalisedInstallSize * WEIGHTS.efficiency.installSize +
  normalisedDependencies * WEIGHTS.efficiency.dependencies +
  normalisedTotalDependencies * WEIGHTS.efficiency.totalDependencies +
  normalisedPackageSize * WEIGHTS.efficiency.packageSize +
  normalisedVulnerabilities * WEIGHTS.efficiency.vulnerabilities +
  typesScore * WEIGHTS.efficiency.types +
  deprecationScore * WEIGHTS.efficiency.deprecation

// Deprecation considered harmful
const efficiencyScore = deprecated
  ? -1
  : clampInRange(rawEfficiencyScore)

  const quadrant = resolveQuadrant(adoptionScore, efficiencyScore)

  return {
    adoptionScore,
    efficiencyScore,
    id: packageItem.id,
    license: packageItem.license,
    name: packageItem.name,
    metrics: {
      dependencies,
      deprecated,
      downloads,
      freshnessPercent,
      freshnessScore,
      installSize,
      packageSize,
      totalDependencies,
      totalLikes,
      types,
      vulnerabilities,
    },
    quadrant,
    x: adoptionScore,
    y: efficiencyScore,
  }
}

export function createQuadrantDataset(packages: PackageQuadrantInput[]): PackageQuadrantPoint[] {
  if (!packages.length) return []
  const metricRanges = getQuadrantMetricRanges(packages)
  return packages.map(packageItem => createQuadrantPoint(packageItem, metricRanges))
}