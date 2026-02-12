/**
 * Agent instruction file discovered in a package
 */
export interface AgentFile {
  /** Relative path within the package (e.g., "CLAUDE.md", ".github/copilot-instructions.md") */
  path: string
  /** File content */
  content: string
  /** Human-readable display name (e.g., "Claude Code", "GitHub Copilot") */
  displayName: string
}

/**
 * Result of gathering all data needed to generate llms.txt
 */
export interface LlmsTxtResult {
  /** Package name (e.g., "nuxt" or "@nuxt/kit") */
  packageName: string
  /** Resolved version (e.g., "3.12.0") */
  version: string
  /** Package description from packument */
  description?: string
  /** Homepage URL */
  homepage?: string
  /** Repository URL */
  repositoryUrl?: string
  /** README content (raw markdown) */
  readme?: string
  /** Discovered agent instruction files */
  agentFiles: AgentFile[]
}
