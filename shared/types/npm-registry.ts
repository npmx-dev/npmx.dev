/**
 * npm Registry API Types
 * Custom types for search and download APIs (not covered by @npm/types).
 *
 * @see https://github.com/npm/types
 * @see https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md
 */

// Re-export official npm types for packument/manifest
export type { Packument, PackumentVersion, Manifest, ManifestVersion, PackageJSON } from '@npm/types'

/**
 * Person/contact type extracted from @npm/types Contact interface
 * Used for maintainers, authors, publishers
 */
export interface NpmPerson {
  name?: string
  email?: string
  url?: string
  username?: string
}

/**
 * Search API response
 * Returned by GET /-/v1/search
 * Note: Not covered by @npm/types (see https://github.com/npm/types/issues/28)
 */
export interface NpmSearchResponse {
  objects: NpmSearchResult[]
  total: number
  time: string
}

export interface NpmSearchResult {
  package: NpmSearchPackage
  score: NpmSearchScore
  searchScore: number
  flags?: {
    unstable?: boolean
    insecure?: boolean
  }
}

/**
 * Trusted publisher info from search API
 * Present when package was published via OIDC (e.g., GitHub Actions)
 */
export interface NpmSearchTrustedPublisher {
  /** OIDC provider identifier (e.g., "github", "gitlab") */
  id: string
  /** OIDC config ID */
  oidcConfigId?: string
}

/**
 * Publisher info with optional trusted publisher and actor details
 */
export interface NpmSearchPublisher extends NpmPerson {
  /** Trusted publisher info (present if published via OIDC) */
  trustedPublisher?: NpmSearchTrustedPublisher
  /** Actor who triggered the publish (for trusted publishing) */
  actor?: {
    name: string
    type: 'user' | 'team'
    email?: string
  }
}

export interface NpmSearchPackage {
  name: string
  scope?: string
  version: string
  description?: string
  keywords?: string[]
  date: string
  links: {
    npm?: string
    homepage?: string
    repository?: string
    bugs?: string
  }
  author?: NpmPerson
  publisher?: NpmSearchPublisher
  maintainers?: NpmPerson[]
}

export interface NpmSearchScore {
  final: number
  detail: {
    quality: number
    popularity: number
    maintenance: number
  }
}

/**
 * Attestations/provenance info on package version dist
 * Present when package was published with provenance
 * Note: Not covered by @npm/types
 */
export interface NpmVersionAttestations {
  /** URL to fetch full attestation details */
  url: string
  /** Provenance info */
  provenance: {
    /** SLSA predicate type URL */
    predicateType: string
  }
}

/**
 * Extended dist info that may include attestations
 * The base PackumentVersion.dist doesn't include attestations
 */
export interface NpmVersionDist {
  shasum: string
  tarball: string
  integrity?: string
  fileCount?: number
  unpackedSize?: number
  signatures?: Array<{
    keyid: string
    sig: string
  }>
  /** Attestations/provenance (present if published with provenance) */
  attestations?: NpmVersionAttestations
}

/**
 * Download counts API response
 * From https://api.npmjs.org/downloads/
 * Note: Not covered by @npm/types
 */
export interface NpmDownloadCount {
  downloads: number
  start: string
  end: string
  package: string
}

export interface NpmDownloadRange {
  downloads: Array<{
    downloads: number
    day: string
  }>
  start: string
  end: string
  package: string
}

/**
 * Organization API types
 * These require authentication
 * Note: Not covered by @npm/types
 */
export interface NpmOrgMember {
  user: string
  role: 'developer' | 'admin' | 'owner'
}

export interface NpmTeam {
  name: string
  description?: string
  members?: string[]
}

export interface NpmPackageAccess {
  permissions: 'read-only' | 'read-write'
}

/**
 * Trusted Publishing types
 * Note: Not covered by @npm/types
 */
export interface NpmTrustedPublisher {
  type: 'github-actions' | 'gitlab-ci'
  // GitHub Actions specific
  repository?: string
  workflow?: string
  environment?: string
  // GitLab CI specific
  namespace?: string
  project?: string
  ciConfigPath?: string
}
