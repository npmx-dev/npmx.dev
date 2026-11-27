import type { DocsResponse } from '#shared/types/docs'
import { describe, expect, it } from 'vite-plus/test'
import { resolveDocsResponse } from '../../../../app/utils/docs-response'

const context = {
  packageName: 'effect',
  version: '3.19.19',
  fallbackMessage: 'We could not generate docs for this version.',
}

const okDocs: DocsResponse = {
  package: 'ufo',
  version: '1.6.4',
  html: '<section>full docs</section>',
  toc: '<ul></ul>',
  status: 'ok',
}

describe('resolveDocsResponse', () => {
  it('returns data directly when there is no fetch error', () => {
    expect(resolveDocsResponse(okDocs, null, context)).toEqual(okDocs)
    expect(resolveDocsResponse(undefined, undefined, context)).toBeNull()
  })

  it('extracts partial docs from a 503 error payload so the UI still renders them', () => {
    const partial = resolveDocsResponse(
      okDocs,
      {
        data: {
          package: 'effect',
          version: '3.19.19',
          html: '<section>partial</section>',
          toc: '<ul><li>A</li></ul>',
          status: 'ok',
          truncated: true,
        },
      },
      context,
    )

    expect(partial).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '<section>partial</section>',
      toc: '<ul><li>A</li></ul>',
      status: 'ok',
      message: undefined,
      truncated: true,
    })
  })

  it('returns the server error message from a 503 error payload over stale data', () => {
    const result = resolveDocsResponse(
      okDocs,
      {
        data: {
          package: 'effect',
          version: '3.19.19',
          html: '',
          toc: null,
          status: 'error',
          message: 'Failed to generate documentation. Please try again later.',
        },
      },
      context,
    )

    expect(result).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '',
      toc: null,
      status: 'error',
      message: 'Failed to generate documentation. Please try again later.',
      truncated: undefined,
    })
  })

  it('falls back to a generic error state when a 503 response has no docs body', () => {
    expect(resolveDocsResponse(okDocs, { data: {} }, context)).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '',
      toc: null,
      status: 'error',
      message: context.fallbackMessage,
    })
    expect(resolveDocsResponse(okDocs, {}, context)).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '',
      toc: null,
      status: 'error',
      message: context.fallbackMessage,
    })
    expect(resolveDocsResponse(okDocs, { data: { status: 'unknown' } }, context)).toEqual({
      package: 'effect',
      version: '3.19.19',
      html: '',
      toc: null,
      status: 'error',
      message: context.fallbackMessage,
    })
  })
})
