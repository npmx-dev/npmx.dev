export interface DependencySize {
  name: string
  version: string
  size: number
  /** True if this is an optional dependency */
  optional?: boolean
}

export interface InstallSizeResult {
  /** Package name */
  package: string
  /** Package version */
  version: string
  /** Unpacked size of the package itself (bytes) */
  selfSize: number
  /** Total unpacked size including all dependencies (bytes) */
  totalSize: number
  /** Number of dependencies (including transitive) */
  dependencyCount: number
  /** Breakdown of dependency sizes */
  dependencies: DependencySize[]
}
