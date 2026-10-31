type DocsStatus = 'ok' | 'missing' | 'error'

export interface DocsResponse {
  package: string
  version: string
  html: string
  toc: string | null
  breadcrumbs?: string | null
  status: DocsStatus
  message?: string
}
