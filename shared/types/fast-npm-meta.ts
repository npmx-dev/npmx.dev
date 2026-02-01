/**
 * Types for fast-npm-meta API responses
 * @see https://github.com/antfu/fast-npm-meta
 */

/**
 * Response from GET /:pkg endpoint
 * Returns resolved version info for a single package
 */
export interface FastNpmMetaResponse {
  /** Package name */
  name: string
  /** The specifier used (e.g., "latest", "^2.1.0", "alpha") */
  specifier: string
  /** Resolved version */
  version: string
  /** When this version was published (ISO 8601) */
  publishedAt: string
  /** When the cache was last synced (timestamp) */
  lastSynced: number
  /** Error message if resolution failed (when throw=false) */
  error?: string
}

/**
 * Response from GET /versions/:pkg endpoint
 * Returns all versions and dist-tags for a package
 */
export interface FastNpmMetaVersionsResponse {
  /** Package name */
  name: string
  /** The specifier used */
  specifier: string
  /** Dist tags (latest, alpha, beta, etc.) */
  distTags: Record<string, string>
  /** When the cache was last synced (timestamp) */
  lastSynced: number
  /** All versions (filtered if specifier provided) */
  versions: string[]
  /** Version publish times (ISO 8601) */
  time: Record<string, string>
  /** Error message if resolution failed (when throw=false) */
  error?: string
}
