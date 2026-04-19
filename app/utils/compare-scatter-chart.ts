import type { VueUiScatterDatasetItem } from 'vue-data-ui'
import { applyEllipsis } from '~/utils/charts'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'

const MILLISECONDS_IN_A_DAY = 1000 * 60 * 60 * 24

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function toFreshnessScore(value: unknown, maximumAgeInDays = 365): number | null {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(String(value))

  if (Number.isNaN(date.getTime())) {
    return null
  }

  const ageInMilliseconds = Date.now() - date.getTime()
  const ageInDays = ageInMilliseconds / MILLISECONDS_IN_A_DAY
  const normalizedFreshness = 1 - ageInDays / maximumAgeInDays

  if (normalizedFreshness < 0) {
    return 0
  }

  if (normalizedFreshness > 1) {
    return 100
  }

  return normalizedFreshness * 100
}

function getNumericFacetValue(
  packageData: PackageComparisonData,
  facet: ComparisonFacet,
): number | null {
  switch (facet) {
    case 'downloads':
      return isFiniteNumber(packageData.downloads) ? packageData.downloads : null

    case 'totalLikes':
      return isFiniteNumber(packageData.totalLikes) ? packageData.totalLikes : null

    case 'packageSize':
      return isFiniteNumber(packageData.packageSize) ? packageData.packageSize : null

    case 'installSize':
      return isFiniteNumber(packageData.installSize?.totalSize)
        ? packageData.installSize.totalSize
        : null

    case 'dependencies':
      return isFiniteNumber(packageData.directDeps) ? packageData.directDeps : null

    case 'totalDependencies':
      return isFiniteNumber(packageData.installSize?.dependencyCount)
        ? packageData.installSize.dependencyCount
        : null

    case 'vulnerabilities':
      return isFiniteNumber(packageData.vulnerabilities?.count)
        ? packageData.vulnerabilities.count
        : null

    case 'types':
      return packageData.analysis?.types?.kind ? 1 : 0

    case 'lastUpdated':
      return toFreshnessScore(packageData.metadata?.lastUpdated)

    case 'githubStars':
      return isFiniteNumber(packageData.metadata?.github?.stars)
        ? packageData.metadata.github.stars
        : null

    case 'githubIssues':
      return isFiniteNumber(packageData.metadata?.github?.issues)
        ? packageData.metadata.github.issues
        : null

    default:
      return null
  }
}

function getPackageName(packageData: PackageComparisonData, fallbackName: string): string {
  return packageData.package?.name || fallbackName
}

export function buildCompareScatterChartDataset(
  packagesData: ReadonlyArray<PackageComparisonData | null>,
  packages: string[],
  xFacet: ComparisonFacet,
  yFacet: ComparisonFacet,
): VueUiScatterDatasetItem[] {
  return packagesData.reduce<VueUiScatterDatasetItem[]>((acc, packageData, index) => {
    if (!packageData) {
      return acc
    }

    const x = getNumericFacetValue(packageData, xFacet)
    const y = getNumericFacetValue(packageData, yFacet)

    if (x === null || y === null) {
      return acc
    }

    const fallbackName = packages[index] || `package-${index + 1}`
    const packageName = getPackageName(packageData, fallbackName)

    acc.push({
      name: applyEllipsis(packageName, 14),
      fullName: packageName,
      color: isListedFramework(packageName) ? getFrameworkColor(packageName) : undefined,
      values: [
        {
          x,
          y,
          name: applyEllipsis(packageName, 14),
          fullName: packageName,
        },
      ],
    })

    return acc
  }, [])
}
