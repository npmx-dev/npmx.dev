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
 * Response from README API endpoint
 */
export interface ReadmeResponse {
  /** Rendered HTML content */
  html: string
  /** Extracted playground/demo links */
  playgroundLinks: PlaygroundLink[]
}
