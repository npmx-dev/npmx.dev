import validatePackageName from 'validate-npm-package-name'
import { NPM_REGISTRY } from '#shared/utils/constants'
import { encodePackageName } from '#shared/utils/npm'

/**
 * Normalize a package name for comparison by removing common variations.
 * This aims to mirror npm's typosquatting detection algorithm.
 */
export function normalizePackageName(name: string): string {
  // Remove scope if present
  const unscoped = name.startsWith('@') ? name.split('/')[1] || name : name

  // Normalize: lowercase, remove punctuation (.-_), remove 'js' and 'node' suffixes/prefixes
  return (
    unscoped
      .toLowerCase()
      // Remove all punctuation
      .replace(/[.\-_]/g, '')
      // Remove common suffixes/prefixes
      .replace(/^(node|js)|(-?js|-?node)$/g, '')
  )
}

/**
 * Calculate similarity between two strings using Levenshtein distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1, // deletion
        )
      }
    }
  }

  return matrix[b.length]![a.length]!
}

export function isValidNewPackageName(name: string): boolean {
  if (!name) return false
  const result = validatePackageName(name)
  return result.validForNewPackages === true
}

export interface SimilarPackage {
  name: string
  description?: string
  similarity: 'exact-match' | 'very-similar' | 'similar'
}

export interface CheckNameResult {
  name: string
  available: boolean
  valid: boolean
  validationErrors?: string[]
  validationWarnings?: string[]
  similarPackages?: SimilarPackage[]
}

export async function checkPackageExists(
  name: string,
  options: Parameters<typeof $fetch>[1] = {},
): Promise<boolean> {
  try {
    await $fetch(`${NPM_REGISTRY}/${encodePackageName(name)}`, {
      ...options,
      method: 'HEAD',
    })
    return true
  } catch {
    return false
  }
}

export async function findSimilarPackages(
  name: string,
  options: Parameters<typeof $fetch>[1] = {},
): Promise<SimilarPackage[]> {
  const normalized = normalizePackageName(name)
  const similar: SimilarPackage[] = []

  try {
    const searchResponse = await $fetch<{
      objects: Array<{
        package: {
          name: string
          description?: string
        }
      }>
    }>(`${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(name)}&size=20`, options)

    for (const obj of searchResponse.objects) {
      const pkgName = obj.package.name
      const pkgNormalized = normalizePackageName(pkgName)

      // Skip if it's the exact same name
      if (pkgName === name) {
        similar.push({
          name: pkgName,
          description: obj.package.description,
          similarity: 'exact-match',
        })
        continue
      }

      // Check if normalized names match (high similarity)
      if (normalized === pkgNormalized) {
        similar.push({
          name: pkgName,
          description: obj.package.description,
          similarity: 'very-similar',
        })
        continue
      }

      // Check Levenshtein distance for similar names
      const distance = levenshteinDistance(normalized, pkgNormalized)
      const maxLen = Math.max(normalized.length, pkgNormalized.length)

      // Guard against division by zero
      if (maxLen === 0) continue

      const similarityScore = 1 - distance / maxLen

      if (similarityScore >= 0.8 || distance <= 2) {
        similar.push({
          name: pkgName,
          description: obj.package.description,
          similarity: 'similar',
        })
      }
    }

    // Sort by similarity (exact > very-similar > similar)
    const order = { 'exact-match': 0, 'very-similar': 1, 'similar': 2 }
    similar.sort((a, b) => order[a.similarity] - order[b.similarity])

    return similar.slice(0, 10) // Limit to 10 results
  } catch {
    return []
  }
}

export async function checkPackageName(
  name: string,
  options: Parameters<typeof $fetch>[1] = {},
): Promise<CheckNameResult> {
  const validation = validatePackageName(name)
  const valid = validation.validForNewPackages === true

  const result: CheckNameResult = {
    name,
    available: false,
    valid,
  }

  if (validation.errors?.length) {
    result.validationErrors = validation.errors
  }
  if (validation.warnings?.length) {
    result.validationWarnings = validation.warnings
  }

  // If name is not valid for new packages, return early
  if (!valid) {
    return result
  }

  // Check if package exists and find similar packages in parallel
  const [exists, similarPackages] = await Promise.all([
    checkPackageExists(name, options),
    findSimilarPackages(name, options),
  ])

  result.available = !exists
  result.similarPackages = similarPackages

  return result
}
