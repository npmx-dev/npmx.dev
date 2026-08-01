export interface PackageEntity {
  id: string // "lodash@4.17.21"
  name: string // "lodash"
  version: string // "4.17.21"
  unpackedSize: number
  tarball: string
}

export interface DependencyEdgeEntity {
  id?: number // auto-increment
  parentKey: string // "nuxt@4.5.0"
  childName: string // "lodash"
  childRange: string // "^4.17.0"
  resolvedVersionKey?: string // "lodash@4.17.21" (cached once semver resolved)
  isOptional: boolean
}

export interface AnalysisSessionEntity {
  rootKey: string // "nuxt@4.5.0"
  timestamp: number
  resolvedPackageKeys: string[] // Flat list of all unique dependencies in the tree
  optionalPackageKeys: string[] // Flat list of all unique optional dependencies in the tree
  totalSize: number
  isFinished: boolean
  totalOptionalSize: number
}

// Root package response with all its versions
export interface NpmPackageMetadata {
  'name': string
  'dist-tags': Record<string, string>
  'versions': Record<string, PackageData>
}

export interface PackageData {
  name: string
  version: string
  // Platform restrictions (crucial to avoid summing native binaries that are not touched)
  os?: string[]
  cpu?: string[]
  libc?: string[]
  // distribution data
  dist: {
    tarball: string
    unpackedSize?: number
    shasum?: string
    integrity?: string
  }
  // Different types of dependencies
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export interface DiffResult {
  name: string
  isOptional: boolean
  status: 'added' | 'removed' | 'changed' | 'unchanged'
  v1: { version: string; size: number } | null
  v2: { version: string; size: number } | null
  sizeDelta: number
}

export interface UIDiffResult extends Omit<DiffResult, 'v1' | 'v2'> {
  v1: { version: string; size: number; sizeText: string } | null
  v2: { version: string; size: number; sizeText: string } | null
  statusText: string
  sizeDeltaText: string
}

interface Summary {
  sizeDelta: number
  mandatorySizeDelta: number
  netDependencies: number
  added: number
  removed: number
}

export interface UISummary extends Summary {
  // B/KB/MB
  sizeDeltaText: string
  // bytes
  sizeDeltaBytesText: string
  // B/KB/MB
  mandatorySizeDeltaText: string
  // bytes
  mandatorySizeDeltaBytesText: string
  netDependenciesText: string
  addedText: string
  removedText: string
}

export type AnalyzeCauseWorkerRequest =
  | {
      type: 'analyze-cause'
      id: number | string
      packageName: string
      fromVersion: string
      toVersion: string
      ignoreOptional?: boolean
    }
  | {
      type: 'analyze-cause-abort'
      id: number | string
    }

export type AnalyzeWorkerResponse =
  | { type: 'sessions'; id: number | string; fromVersion: string; toVersion: string }
  | { type: 'result'; id: number | string; result: DiffResult[]; summary: Summary }
  | { type: 'error'; id: number | string; message: string }
  | { type: 'aborting'; id: number | string }
  | { type: 'aborted'; id: number | string }
