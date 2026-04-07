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

const WEIGHTS = {
  adoption: {
    downloads: 0.75, // dominant signal because they best reflect real-world adoption (in the data we have through facets currently)
    freshness: 0.15, // small correction so stale packages are slightly
    likes: 0.1, // might be pumped up in the future when ./npmx likes are more mainstream
  },
  efficiency: {
    installSize: 0.3, // weighted highest because it best reflects consumer footprint

    // dependency weights are already measured in install size in some way, but still useful knobs to find the sweet spot
    dependencies: 0.05, // direct deps capture architectural and supply-chain complexity
    totalDependencies: 0.2, // same for total deps

    packageSize: 0.1,
    vulnerabilities: 0.2, // penalize security burden
    types: 0.15, // TS support
    // Note: the 'deprecated' metric is not weighed because it just forces a -1 evaluation
  },
}

/* Fixed logarithmic ceilings to normalize metrics onto a stable [-1, 1] scale.
 *  This avoids dataset-relative min/max normalization, which would shift scores depending
 *  on which packages are being compared. Ceilings act as reference points for what is
 *  considered 'high' for each metric, ensuring consistent positioning across different
 *  datasets while preserving meaningful differences via log scaling.
 */
const LOG_CEILINGS = {
  downloads: 100_000_000,
  likes: 1000, // might be pumped up in the future when ./npmx likes are more mainstream
  installSize: 25_000_000,
  dependencies: 100,
  totalDependencies: 1_000,
  packageSize: 15_000_000,
}

const VULNERABILITY_PENALTY_MULTIPLIER = 2

function clampInRange(value: number, min = -1, max = 1): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function normalizeBoolean(value: boolean): number {
  return value ? 1 : -1
}

function toSafeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getNormalisedFreshness(
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
  const normalisedAge = getNormalisedFreshness(value, maximumAgeInDays)
  if (normalisedAge === null) return -1
  return clampInRange(normalisedAge * 2 - 1)
}

function getFreshnessPercentage(
  value: string | Date | null | undefined,
  maximumAgeInDays = 365,
): number {
  const normalisedAge = getNormalisedFreshness(value, maximumAgeInDays)
  if (normalisedAge === null) return 0
  return Math.max(0, Math.min(1, normalisedAge)) * 100
}

function normalizeLogHigherBetter(value: number, upperBound: number): number {
  const safeValue = Math.max(0, value)
  const safeUpperBound = Math.max(1, upperBound)
  const normalised = Math.log(safeValue + 1) / Math.log(safeUpperBound + 1)
  return clampInRange(normalised * 2 - 1)
}

function normalizeLogLowerBetter(value: number, upperBound: number): number {
  return -normalizeLogHigherBetter(value, upperBound)
}

function getVulnerabilityPenalty(value: number): number {
  if (value <= 0) return 1

  const penalty = normalizeLogLowerBetter(value, 10)
  return penalty < 0 ? penalty * VULNERABILITY_PENALTY_MULTIPLIER : penalty
}

function resolveQuadrant(x: number, y: number): PackageQuadrantPoint['quadrant'] {
  if (x >= 0 && y >= 0) return 'TOP_RIGHT'
  if (x < 0 && y >= 0) return 'TOP_LEFT'
  if (x >= 0 && y < 0) return 'BOTTOM_RIGHT'
  return 'BOTTOM_LEFT'
}

function createQuadrantPoint(packageItem: PackageQuadrantInput): PackageQuadrantPoint {
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

  const normalisedDownloads = normalizeLogHigherBetter(downloads, LOG_CEILINGS.downloads)
  const normalisedLikes = normalizeLogHigherBetter(totalLikes, LOG_CEILINGS.likes)
  const normalisedInstallSize = normalizeLogLowerBetter(installSize, LOG_CEILINGS.installSize)
  const normalisedDependencies = normalizeLogLowerBetter(dependencies, LOG_CEILINGS.dependencies)
  const normalisedTotalDependencies = normalizeLogLowerBetter(
    totalDependencies,
    LOG_CEILINGS.totalDependencies,
  )
  const normalisedPackageSize = normalizeLogLowerBetter(packageSize, LOG_CEILINGS.packageSize)

  const normalisedVulnerabilities = getVulnerabilityPenalty(vulnerabilities)
  const typesScore = normalizeBoolean(types)

  const adoptionScore = clampInRange(
    normalisedDownloads * WEIGHTS.adoption.downloads +
      freshnessScore * WEIGHTS.adoption.freshness +
      normalisedLikes * WEIGHTS.adoption.likes,
  )

  const rawEfficiencyScore =
    normalisedInstallSize * WEIGHTS.efficiency.installSize +
    normalisedDependencies * WEIGHTS.efficiency.dependencies +
    normalisedTotalDependencies * WEIGHTS.efficiency.totalDependencies +
    normalisedPackageSize * WEIGHTS.efficiency.packageSize +
    normalisedVulnerabilities * WEIGHTS.efficiency.vulnerabilities +
    typesScore * WEIGHTS.efficiency.types

  const efficiencyScore = deprecated ? -1 : clampInRange(rawEfficiencyScore)
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
  return packages.map(packageItem => createQuadrantPoint(packageItem))
}
