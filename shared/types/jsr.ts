/**
 * JSR (jsr.io) Registry API Types
 *
 * @see https://jsr.io/docs/api
 */

/**
 * JSR package metadata from meta.json
 * GET https://jsr.io/@<scope>/<package-name>/meta.json
 */
export interface JsrPackageMeta {
  /** Package scope (without @) */
  scope: string
  /** Package name */
  name: string
  /** Map of versions to version metadata */
  versions: Record<string, JsrVersionMeta>
}

/**
 * JSR version metadata (minimal, from meta.json)
 */
export interface JsrVersionMeta {
  /** If true, the version has been yanked */
  yanked?: boolean
}

/**
 * JSR package info response for our API
 * Indicates whether a package exists on JSR
 */
export interface JsrPackageInfo {
  /** Whether the package exists on JSR */
  exists: boolean
  /** JSR scope (without @) */
  scope?: string
  /** JSR package name */
  name?: string
  /** Full JSR URL */
  url?: string
  /** Latest version on JSR (non-yanked) */
  latestVersion?: string
}
