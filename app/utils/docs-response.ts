import type { DocsResponse } from '#shared/types/docs'

function isDocsStatus(value: unknown): value is DocsResponse['status'] {
  return value === 'ok' || value === 'missing' || value === 'error'
}

export function resolveDocsResponse(
  data: DocsResponse | null | undefined,
  error: { data?: unknown } | null | undefined,
  context: { packageName: string; version: string; fallbackMessage: string },
): DocsResponse | null {
  if (!error) {
    return data ?? null
  }

  const raw = error.data
  if (raw && typeof raw === 'object' && 'status' in raw && isDocsStatus(raw.status)) {
    const record = raw as Record<string, unknown>
    return {
      package: typeof record.package === 'string' ? record.package : context.packageName,
      version: typeof record.version === 'string' ? record.version : context.version,
      html: typeof record.html === 'string' ? record.html : '',
      toc: typeof record.toc === 'string' ? record.toc : null,
      status: raw.status,
      message: typeof record.message === 'string' ? record.message : undefined,
      truncated: typeof record.truncated === 'boolean' ? record.truncated : undefined,
    }
  }

  return {
    package: context.packageName,
    version: context.version,
    html: '',
    toc: null,
    status: 'error',
    message: context.fallbackMessage,
  }
}
