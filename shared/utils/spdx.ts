import spdxLicenseIds from 'spdx-license-list/spdx-simple.json'

/**
 * Set of all valid SPDX license identifiers.
 * Sourced from spdx-license-list package which stays up-to-date with
 * the official SPDX license list.
 *
 * @see https://spdx.org/licenses/
 */
export const SPDX_LICENSE_IDS: Set<string> = new Set(spdxLicenseIds)

/**
 * Check if a license identifier is a valid SPDX license.
 * @see https://spdx.org/licenses/
 */
export function isValidSpdxLicense(license: string): boolean {
  return SPDX_LICENSE_IDS.has(license)
}

/**
 * Generate an SPDX license URL for the given license identifier.
 * Returns null if the license is not a valid SPDX identifier.
 * @see https://spdx.org/licenses/
 */
export function getSpdxLicenseUrl(license: string | undefined): string | null {
  if (!license) return null
  const trimmed = license.trim()
  if (!SPDX_LICENSE_IDS.has(trimmed)) return null
  return `https://spdx.org/licenses/${trimmed}.html`
}

/**
 * Token types for parsed license expressions
 */
export interface LicenseToken {
  type: 'license' | 'operator'
  value: string
  url?: string
}

/**
 * Parse an SPDX license expression into tokens.
 * Handles compound expressions like "MIT OR Apache-2.0", "(MIT AND Zlib)".
 * Strips parentheses for cleaner display.
 *
 * @example
 * parseLicenseExpression('MIT') // [{ type: 'license', value: 'MIT', url: '...' }]
 * parseLicenseExpression('MIT OR Apache-2.0')
 * // [{ type: 'license', value: 'MIT', url: '...' }, { type: 'operator', value: 'OR' }, { type: 'license', value: 'Apache-2.0', url: '...' }]
 */
export function parseLicenseExpression(expression: string): LicenseToken[] {
  const result: LicenseToken[] = []
  // Match operators first (OR, AND, WITH), then license IDs - ignore parentheses
  // Operators must be checked first to avoid being captured as license identifiers
  const pattern = /\b(OR|AND|WITH)\b|([A-Za-z0-9.\-+]+)/g
  let match

  while ((match = pattern.exec(expression)) !== null) {
    if (match[1]) {
      // Operator (OR, AND, WITH)
      result.push({ type: 'operator', value: match[1] })
    } else if (match[2]) {
      // License identifier
      const id = match[2]
      const isValid = isValidSpdxLicense(id)
      result.push({
        type: 'license',
        value: id,
        url: isValid ? `https://spdx.org/licenses/${id}.html` : undefined,
      })
    }
  }

  return result
}
