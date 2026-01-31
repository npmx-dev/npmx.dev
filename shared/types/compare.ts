/** A change in a dependency between versions */
export interface DependencyChange {
  /** Package name */
  name: string
  /** Which dependency section it belongs to */
  section: 'dependencies' | 'devDependencies' | 'peerDependencies' | 'optionalDependencies'
  /** Version in the "from" version (null if newly added) */
  from: string | null
  /** Version in the "to" version (null if removed) */
  to: string | null
  /** Type of change */
  type: 'added' | 'removed' | 'updated'
  /** Best-effort semver diff type */
  semverDiff?: 'major' | 'minor' | 'patch' | 'prerelease' | null
}

/** File change info in the comparison */
export interface FileChange {
  /** File path */
  path: string
  /** Type of change */
  type: 'added' | 'removed' | 'modified'
  /** Old file size (for removed/modified) */
  oldSize?: number
  /** New file size (for added/modified) */
  newSize?: number
}

/** Comparison summary response from the API */
export interface CompareResponse {
  /** Package name */
  package: string
  /** Source version */
  from: string
  /** Target version */
  to: string
  /** package.json content for both versions */
  packageJson: {
    from: Record<string, unknown> | null
    to: Record<string, unknown> | null
  }
  /** File changes between versions */
  files: {
    added: FileChange[]
    removed: FileChange[]
    modified: FileChange[]
  }
  /** Dependency changes */
  dependencyChanges: DependencyChange[]
  /** Stats summary */
  stats: {
    totalFilesFrom: number
    totalFilesTo: number
    filesAdded: number
    filesRemoved: number
    filesModified: number
  }
  /** Metadata about the comparison */
  meta: {
    /** Whether file list was truncated due to size */
    truncated?: boolean
    /** Any warnings during comparison */
    warnings?: string[]
    /** Time taken to compute (ms) */
    computeTime?: number
  }
}

/** A line segment in a diff (for inline word-level diffs) */
export interface DiffLineSegment {
  value: string
  type: 'insert' | 'delete' | 'normal'
}

/** A single line in the diff */
export interface DiffLine {
  /** Line type */
  type: 'insert' | 'delete' | 'normal'
  /** Old line number (for normal/delete) */
  oldLineNumber?: number
  /** New line number (for normal/insert) */
  newLineNumber?: number
  /** Line number (for insert/delete) */
  lineNumber?: number
  /** Line content segments */
  content: DiffLineSegment[]
}

/** A hunk in the diff */
export interface DiffHunk {
  type: 'hunk'
  /** Original hunk header content */
  content: string
  /** Old file start line */
  oldStart: number
  /** Number of lines in old file */
  oldLines: number
  /** New file start line */
  newStart: number
  /** Number of lines in new file */
  newLines: number
  /** Lines in this hunk */
  lines: DiffLine[]
}

/** A skip block (collapsed unchanged lines) */
export interface DiffSkipBlock {
  type: 'skip'
  /** Number of lines skipped */
  count: number
  /** Context message */
  content: string
}

/** Parsed file diff */
export interface FileDiff {
  /** Old file path */
  oldPath: string
  /** New file path */
  newPath: string
  /** File change type */
  type: 'add' | 'delete' | 'modify'
  /** Hunks in the diff */
  hunks: (DiffHunk | DiffSkipBlock)[]
}

/** Per-file diff response from the API */
export interface FileDiffResponse {
  /** Package name */
  package: string
  /** Source version */
  from: string
  /** Target version */
  to: string
  /** File path */
  path: string
  /** File change type */
  type: 'add' | 'delete' | 'modify'
  /** Parsed diff hunks */
  hunks: (DiffHunk | DiffSkipBlock)[]
  /** Diff stats */
  stats: {
    additions: number
    deletions: number
  }
  /** Metadata */
  meta: {
    /** Whether diff was truncated */
    truncated?: boolean
    /** Time taken to compute (ms) */
    computeTime?: number
  }
}
