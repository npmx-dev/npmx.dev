function isTruthyQueryValue(value: unknown): boolean {
  const normalizedValue = Array.isArray(value) ? value[0] : value
  return normalizedValue === 'true' || normalizedValue === '1'
}

export function shouldIncludeRepositoryStars(query: Record<string, unknown>): boolean {
  return isTruthyQueryValue(query.includeRepositoryStars)
}

export function getPackageMetaCacheKey(pkg: string, includeRepositoryStars: boolean): string {
  const starsCacheKey = includeRepositoryStars ? 'stars:1' : 'stars:0'
  return `package-meta:v2:${starsCacheKey}:${pkg}`
}
