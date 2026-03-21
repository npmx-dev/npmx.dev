export type ScoreCategory = 'documentation' | 'maintenance' | 'types' | 'bestPractices' | 'security'

export interface ScoreCheck {
  id: string
  category: ScoreCategory
  points: number
  maxPoints: number
}

export interface PackageScore {
  percentage: number
  totalPoints: number
  maxPoints: number
  checks: ScoreCheck[]
}

interface ScoreInput {
  pkg: SlimPackument | null | undefined
  resolvedVersion: string | null | undefined
  readmeHtml: string
  analysis: PackageAnalysisResponse | null | undefined
  vulnCounts: { total: number; critical: number; high: number } | null | undefined
  vulnStatus: string
  hasProvenance: boolean
}

function computeScore(input: ScoreInput): PackageScore {
  const { pkg, resolvedVersion, readmeHtml, analysis, vulnCounts, vulnStatus, hasProvenance } =
    input
  const checks: ScoreCheck[] = []

  // --- Documentation (3 pts) ---
  // README: 0 = none, 1 = exists but short, 2 = substantial (> 500 chars of content)
  const hasReadme = !!readmeHtml
  const readmePoints = !hasReadme ? 0 : readmeHtml.length > 500 ? 2 : 1
  checks.push({ id: 'has-readme', category: 'documentation', points: readmePoints, maxPoints: 2 })

  const hasDescription = !!pkg?.description?.trim()
  checks.push({
    id: 'has-description',
    category: 'documentation',
    points: hasDescription ? 1 : 0,
    maxPoints: 1,
  })

  // --- Maintenance (2 pts) ---
  // 0 = older than 2 years, 1 = within 2 years, 2 = within 1 year
  const publishTime = resolvedVersion && pkg?.time?.[resolvedVersion]
  const msSincePublish = publishTime ? Date.now() - new Date(publishTime).getTime() : null
  const oneYear = 365 * 24 * 60 * 60 * 1000
  const twoYears = 2 * oneYear

  const maintenancePoints =
    msSincePublish !== null && msSincePublish < oneYear
      ? 2
      : msSincePublish !== null && msSincePublish < twoYears
        ? 1
        : 0
  checks.push({
    id: 'update-frequency',
    category: 'maintenance',
    points: maintenancePoints,
    maxPoints: 2,
  })

  // --- Types (2 pts) ---
  // 0 = none, 1 = @types available, 2 = bundled in package
  const typesKind = analysis?.types?.kind
  const typesPoints = typesKind === 'included' ? 2 : typesKind === '@types' ? 1 : 0
  checks.push({ id: 'has-types', category: 'types', points: typesPoints, maxPoints: 2 })

  // --- Best Practices (4 pts, each 1) ---
  checks.push({
    id: 'has-license',
    category: 'bestPractices',
    points: pkg?.license ? 1 : 0,
    maxPoints: 1,
  })
  checks.push({
    id: 'has-repository',
    category: 'bestPractices',
    points: pkg?.repository ? 1 : 0,
    maxPoints: 1,
  })
  checks.push({
    id: 'has-provenance',
    category: 'bestPractices',
    points: hasProvenance ? 1 : 0,
    maxPoints: 1,
  })

  const hasEsm = analysis?.moduleFormat === 'esm' || analysis?.moduleFormat === 'dual'
  checks.push({ id: 'has-esm', category: 'bestPractices', points: hasEsm ? 1 : 0, maxPoints: 1 })

  // --- Security (3 pts) ---
  // Vulnerabilities are excluded from the score until loaded to avoid score jumps.
  // 0 = has critical/high, 1 = only moderate/low, 2 = none
  const vulnsLoaded = vulnStatus === 'success'
  if (vulnsLoaded) {
    const vulnPoints =
      !vulnCounts || vulnCounts.total === 0
        ? 2
        : vulnCounts.critical === 0 && vulnCounts.high === 0
          ? 1
          : 0
    checks.push({
      id: 'no-vulnerabilities',
      category: 'security',
      points: vulnPoints,
      maxPoints: 2,
    })
  }

  const latestTag = pkg?.['dist-tags']?.latest
  const latestVersion = latestTag ? pkg?.versions[latestTag] : null
  const isNotDeprecated = !latestVersion?.deprecated
  checks.push({
    id: 'not-deprecated',
    category: 'security',
    points: isNotDeprecated ? 1 : 0,
    maxPoints: 1,
  })

  const totalPoints = checks.reduce((sum, c) => sum + c.points, 0)
  const maxPoints = checks.reduce((sum, c) => sum + c.maxPoints, 0)
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

  return { percentage, totalPoints, maxPoints, checks }
}

type MaybeRefLike<T> = Ref<T> | ComputedRef<T>

export function usePackageScore(input: {
  pkg: MaybeRefLike<SlimPackument | null | undefined>
  resolvedVersion: MaybeRefLike<string | null | undefined>
  readmeHtml: MaybeRefLike<string>
  analysis: MaybeRefLike<PackageAnalysisResponse | null | undefined>
  vulnCounts: MaybeRefLike<{ total: number; critical: number; high: number } | null | undefined>
  vulnStatus: MaybeRefLike<string>
  hasProvenance: MaybeRefLike<boolean>
}) {
  return computed<PackageScore>(() =>
    computeScore({
      pkg: input.pkg.value,
      resolvedVersion: input.resolvedVersion.value,
      readmeHtml: input.readmeHtml.value,
      analysis: input.analysis.value,
      vulnCounts: input.vulnCounts.value,
      vulnStatus: input.vulnStatus.value,
      hasProvenance: input.hasProvenance.value,
    }),
  )
}
