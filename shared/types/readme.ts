/**
 * Playground/demo link extracted from README
 */
export interface PlaygroundLink {
  /** The full URL */
  url: string
  /** Provider identifier (e.g., 'stackblitz', 'codesandbox') */
  provider: string
  /** Human-readable provider name (e.g., 'StackBlitz', 'CodeSandbox') */
  providerName: string
  /** Link text from README (e.g., 'Demo', 'Try it online') */
  label: string
}

/**
 * Table of contents item extracted from README headings
 */
export interface TocItem {
  /** Plain text heading (HTML stripped) */
  text: string
  /** Anchor ID (e.g., "user-content-installation") */
  id: string
  /** Original heading depth (1-6) */
  depth: number
}

/**
 * Response from README API endpoint
 */
export interface ReadmeResponse {
  /** Rendered HTML content */
  html: string
  /** Original markdown content */
  md: string
  /** Extracted playground/demo links */
  playgroundLinks: PlaygroundLink[]
  /** Table of contents extracted from headings */
  toc: TocItem[]
}
