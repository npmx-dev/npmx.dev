export type DocsStatus = 'ok' | 'missing' | 'error'

export interface DocsResponse {
  package: string
  version: string
  html: string
  toc: string | null
  breadcrumbs?: string | null
  status: DocsStatus
  message?: string
  /** Available entrypoints for multi-entrypoint packages. Absent for single-entrypoint packages. */
  entrypoints?: string[]
  /** The current entrypoint being viewed. Absent for single-entrypoint packages. */
  entrypoint?: string
}

export interface DocsSearchResponse {
  package: string
  version: string
  index: Record<string, unknown>
}
