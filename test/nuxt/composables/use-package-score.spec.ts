import { describe, expect, it } from 'vitest'

const VERSION: SlimVersion = {
  version: '1.0.0',
  tags: [],
}

function createPkg(overrides: Partial<SlimPackument> = {}): SlimPackument {
  return {
    '_id': 'test',
    'name': 'test',
    'description': 'A test package',
    'license': 'MIT',
    'repository': { type: 'git', url: 'https://github.com/test/test' },
    'dist-tags': { latest: '1.0.0' },
    'time': { '1.0.0': new Date().toISOString(), 'created': '2020-01-01' },
    'versions': { '1.0.0': VERSION },
    'requestedVersion': null,
    ...overrides,
  } as SlimPackument
}

function createAnalysis(overrides: Partial<PackageAnalysisResponse> = {}): PackageAnalysisResponse {
  return {
    package: 'test',
    version: '1.0.0',
    moduleFormat: 'esm',
    types: { kind: 'included' },
    devDependencySuggestion: 'none',
    ...overrides,
  } as PackageAnalysisResponse
}

function createBaseInput() {
  return {
    pkg: ref<SlimPackument | null>(createPkg()),
    resolvedVersion: ref<string | null>('1.0.0'),
    readmeHtml: ref(`<h1>Test Package</h1><p>${'x'.repeat(600)}</p>`),
    analysis: ref<PackageAnalysisResponse | null>(createAnalysis()),
    vulnCounts: ref<{ total: number; critical: number; high: number } | null>({
      total: 0,
      critical: 0,
      high: 0,
    }),
    vulnStatus: ref('success'),
    hasProvenance: ref(true),
  }
}

describe('usePackageScore', () => {
  it('returns 100% for a perfect package', () => {
    const score = usePackageScore(createBaseInput())

    expect(score.value.percentage).toBe(100)
    expect(score.value.totalPoints).toBe(score.value.maxPoints)
  })

  describe('documentation', () => {
    it('gives 0/2 for missing README', () => {
      const input = createBaseInput()
      input.readmeHtml.value = ''

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-readme')!
      expect(check.points).toBe(0)
      expect(check.maxPoints).toBe(2)
    })

    it('gives 1/2 for a short README', () => {
      const input = createBaseInput()
      input.readmeHtml.value = '<p>Short</p>'

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-readme')!
      expect(check.points).toBe(1)
    })

    it('gives 2/2 for a substantial README', () => {
      const check = usePackageScore(createBaseInput()).value.checks.find(
        c => c.id === 'has-readme',
      )!
      expect(check.points).toBe(2)
    })

    it('gives 0/1 for missing description', () => {
      const input = createBaseInput()
      input.pkg.value = createPkg({ description: '' })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-description')!
      expect(check.points).toBe(0)
    })
  })

  describe('maintenance', () => {
    it('gives 2/2 for package updated within 1 year', () => {
      const check = usePackageScore(createBaseInput()).value.checks.find(
        c => c.id === 'update-frequency',
      )!
      expect(check.points).toBe(2)
    })

    it('gives 1/2 for package updated within 2 years', () => {
      const input = createBaseInput()
      const eighteenMonthsAgo = new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString()
      input.pkg.value = createPkg({ time: { '1.0.0': eighteenMonthsAgo, 'created': '2020-01-01' } })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'update-frequency')!
      expect(check.points).toBe(1)
    })

    it('gives 0/2 for package older than 2 years', () => {
      const input = createBaseInput()
      const threeYearsAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
      input.pkg.value = createPkg({ time: { '1.0.0': threeYearsAgo, 'created': '2020-01-01' } })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'update-frequency')!
      expect(check.points).toBe(0)
    })
  })

  describe('types', () => {
    it('gives 2/2 for bundled types', () => {
      const check = usePackageScore(createBaseInput()).value.checks.find(c => c.id === 'has-types')!
      expect(check.points).toBe(2)
    })

    it('gives 1/2 for @types', () => {
      const input = createBaseInput()
      input.analysis.value = createAnalysis({
        types: { kind: '@types', packageName: '@types/test' },
      })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-types')!
      expect(check.points).toBe(1)
    })

    it('gives 0/2 for no types', () => {
      const input = createBaseInput()
      input.analysis.value = createAnalysis({ types: { kind: 'none' } })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-types')!
      expect(check.points).toBe(0)
    })
  })

  describe('best practices', () => {
    it('gives 0 for missing license', () => {
      const input = createBaseInput()
      input.pkg.value = createPkg({ license: undefined })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-license')!
      expect(check.points).toBe(0)
    })

    it('gives 0 for missing provenance', () => {
      const input = createBaseInput()
      input.hasProvenance.value = false

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-provenance')!
      expect(check.points).toBe(0)
    })

    it('gives 0 for CJS-only', () => {
      const input = createBaseInput()
      input.analysis.value = createAnalysis({ moduleFormat: 'cjs' })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-esm')!
      expect(check.points).toBe(0)
    })

    it('gives 1 for dual ESM/CJS', () => {
      const input = createBaseInput()
      input.analysis.value = createAnalysis({ moduleFormat: 'dual' })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'has-esm')!
      expect(check.points).toBe(1)
    })
  })

  describe('security', () => {
    it('gives 2/2 for no vulnerabilities', () => {
      const check = usePackageScore(createBaseInput()).value.checks.find(
        c => c.id === 'no-vulnerabilities',
      )!
      expect(check.points).toBe(2)
    })

    it('gives 1/2 for only moderate/low vulnerabilities', () => {
      const input = createBaseInput()
      input.vulnCounts.value = { total: 3, critical: 0, high: 0 }

      const check = usePackageScore(input).value.checks.find(c => c.id === 'no-vulnerabilities')!
      expect(check.points).toBe(1)
    })

    it('gives 0/2 for critical/high vulnerabilities', () => {
      const input = createBaseInput()
      input.vulnCounts.value = { total: 2, critical: 1, high: 0 }

      const check = usePackageScore(input).value.checks.find(c => c.id === 'no-vulnerabilities')!
      expect(check.points).toBe(0)
    })

    it('excludes vuln check while loading', () => {
      const input = createBaseInput()
      input.vulnStatus.value = 'pending'

      const score = usePackageScore(input).value
      expect(score.checks.find(c => c.id === 'no-vulnerabilities')).toBeUndefined()
      // maxPoints is reduced (no vuln check = 2 less)
      expect(score.maxPoints).toBe(usePackageScore(createBaseInput()).value.maxPoints - 2)
    })

    it('gives 0 for deprecated packages', () => {
      const input = createBaseInput()
      const deprecated: SlimVersion = { ...VERSION, deprecated: 'Use something else' }
      input.pkg.value = createPkg({ versions: { '1.0.0': deprecated } })

      const check = usePackageScore(input).value.checks.find(c => c.id === 'not-deprecated')!
      expect(check.points).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles null pkg gracefully', () => {
      const input = createBaseInput()
      input.pkg.value = null

      const score = usePackageScore(input).value
      expect(score.percentage).toBeGreaterThanOrEqual(0)
      expect(score.percentage).toBeLessThanOrEqual(100)
    })

    it('handles null analysis gracefully', () => {
      const input = createBaseInput()
      input.analysis.value = null

      const score = usePackageScore(input).value
      const types = score.checks.find(c => c.id === 'has-types')!
      const esm = score.checks.find(c => c.id === 'has-esm')!
      expect(types.points).toBe(0)
      expect(esm.points).toBe(0)
    })
  })

  it('is reactive to input changes', () => {
    const input = createBaseInput()
    const score = usePackageScore(input)

    expect(score.value.percentage).toBe(100)

    input.hasProvenance.value = false
    expect(score.value.percentage).toBeLessThan(100)
  })
})
