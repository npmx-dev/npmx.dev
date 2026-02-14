/**
 * Storybook API Types
 * Types for Storybook index.json responses and story navigation
 */

/**
 * Individual story entry from Storybook's index.json
 */
export interface StorybookEntry {
  /** Unique identifier for the story (e.g., "example-button--primary") */
  id: string
  /** Display name of the story */
  name: string
  /** Full title/path (e.g., "Example/Button/Primary") */
  title: string
  /** Import path for the story file */
  importPath?: string
  /** Story tags (e.g., ["autodocs", "play-fn"]) */
  tags?: string[]
  /** Component kind/group */
  kind?: string
  /** Story name (alternative to 'name') */
  story?: string
  /** Story parameters and configuration */
  parameters?: Record<string, any>
  /** Story metadata */
  type?: 'story' | 'docs' | 'component'
}

/**
 * Storybook index.json response structure
 */
export interface StorybookIndexResponse {
  /** Storybook version */
  v?: string
  /** All story entries keyed by their ID */
  entries: Record<string, StorybookEntry>
  /** Global metadata about the Storybook instance */
  metadata?: {
    /** Storybook version info */
    storybook?: {
      version?: string
      configDir?: string
    }
    /** Package information */
    packageJson?: {
      name?: string
      version?: string
      dependencies?: Record<string, string>
    }
  }
}

/**
 * Tree node for Storybook story navigation
 * Similar structure to PackageFileTree but for stories
 */
export interface StorybookFileTree {
  /** Story or group name */
  name: string
  /** Full path from root */
  path: string
  /** Node type */
  type: 'story' | 'directory'
  /** Story ID (only for stories) */
  storyId?: string
  /** Story entry data (only for stories) */
  story?: StorybookEntry
  /** Child nodes (only for directories) */
  children?: StorybookFileTree[]
}

/**
 * Response for Storybook tree API
 */
export interface StorybookTreeResponse {
  package: string
  version: string
  storybookUrl: string
  tree: StorybookFileTree[]
}
