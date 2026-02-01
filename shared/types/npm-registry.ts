/**
 * npm Registry API Types
 * Custom types for search and download APIs (not covered by @npm/types).
 *
 * @see https://github.com/npm/types
 * @see https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md
 */

import type { PackumentVersion } from '@npm/types'
import type { ReadmeResponse } from './readme'

// Re-export official npm types for packument/manifest
export type {
  Packument,
  PackumentVersion,
  Manifest,
  ManifestVersion,
  PackageJSON,
} from '@npm/types'

/** Install scripts info (preinstall, install, postinstall) */
export interface InstallScriptsInfo {
  scripts: ('preinstall' | 'install' | 'postinstall')[]
  content: Record<string, string>
  npxDependencies: Record<string, string>
}

/** PackumentVersion with additional install scripts info */
export type SlimPackumentVersion = PackumentVersion & {
  installScripts?: InstallScriptsInfo
}

/**
 * Slimmed down Packument for client-side use.
 * Strips unnecessary fields to reduce payload size.
 * - readme removed (fetched separately)
 * - versions limited to dist-tag versions only
 * - time limited to dist-tag versions
 */
export interface SlimPackument {
  '_id': string
  '_rev'?: string
  'name': string
  'description'?: string
  'dist-tags': { latest?: string } & Record<string, string>
  /** Only includes time for dist-tag versions + modified/created */
  'time': { modified?: string; created?: string } & Record<string, string>
  'maintainers'?: NpmPerson[]
  'author'?: NpmPerson
  'license'?: string
  'homepage'?: string
  'keywords'?: string[]
  'repository'?: { type?: string; url?: string; directory?: string }
  'bugs'?: { url?: string; email?: string }
  /** Only includes dist-tag versions (with installScripts info added per version) */
  'versions': Record<string, SlimPackumentVersion>
}

/**
 * Lightweight version info for the version list
 */
export interface PackageVersionInfo {
  version: string
  time?: string
  hasProvenance: boolean
  deprecated?: string
}

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
  isStale: boolean
  objects: NpmSearchResult[]
  total: number
  time: string
}

export interface NpmSearchResult {
  package: NpmSearchPackage
  score: NpmSearchScore
  searchScore: number
  /** Download counts (weekly/monthly) */
  downloads?: {
    weekly?: number
    monthly?: number
  }
  /** Number of dependents */
  dependents?: string
  /** Last updated timestamp (ISO 8601) */
  updated?: string
  flags?: {
    unstable?: boolean
    insecure?: number
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
  license?: string
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

/**
 * jsDelivr API Types
 * Used for package file browsing
 */

/**
 * Response from jsDelivr package API (nested structure)
 * GET https://data.jsdelivr.com/v1/packages/npm/{package}@{version}
 */
export interface JsDelivrPackageResponse {
  type: 'npm'
  name: string
  version: string
  /** Default entry point file */
  default: string | null
  /** Nested file tree */
  files: JsDelivrFileNode[]
}

/**
 * A file or directory node from jsDelivr API
 */
export interface JsDelivrFileNode {
  type: 'file' | 'directory'
  name: string
  /** File hash (only for files) */
  hash?: string
  /** File size in bytes (only for files) */
  size?: number
  /** Child nodes (only for directories) */
  files?: JsDelivrFileNode[]
}

/**
 * Tree node for package file browser
 */
export interface PackageFileTree {
  /** File or directory name */
  name: string
  /** Full path from package root */
  path: string
  /** Node type */
  type: 'file' | 'directory'
  /** File size in bytes (only for files) */
  size?: number
  /** Child nodes (only for directories) */
  children?: PackageFileTree[]
}

/**
 * Response from file tree API
 */
export interface PackageFileTreeResponse {
  package: string
  version: string
  default?: string
  tree: PackageFileTree[]
}

/**
 * Response from file content API
 */
export interface PackageFileContentResponse {
  package: string
  version: string
  path: string
  language: string
  content: string
  html: string
  lines: number
  markdownHtml?: ReadmeResponse
}
