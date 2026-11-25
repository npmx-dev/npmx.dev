import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { describe, expect, it, vi } from 'vite-plus/test'

vi.stubGlobal('defineNitroPlugin', <T>(fn: T) => fn)

const { DYNAMIC_OG_CACHE_CONTROL, normalizeOgImageResponseHeaders } =
  await import('../../../../server/plugins/og-image-headers')

function createMockEvent(path: string, statusCode: number, headers: Record<string, string> = {}) {
  const req = new IncomingMessage(new Socket())
  req.url = path
  req.method = 'GET'
  const res = new ServerResponse(req)
  res.statusCode = statusCode
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
  return { event: createEvent(req, res), res }
}

describe('normalizeOgImageResponseHeaders', () => {
  it('removes Vary and adds stale-while-revalidate on 200 image responses under /_og/d/', () => {
    const { event, res } = createMockEvent('/_og/d/c_Package.takumi,name_vue,s_abc.png', 200, {
      'content-type': 'image/png',
      'vary': 'accept-encoding, host',
      'cache-control': 'public, max-age=86400, s-maxage=86400, immutable',
    })

    normalizeOgImageResponseHeaders(event)

    expect(res.getHeader('vary')).toBeUndefined()
    expect(res.getHeader('cache-control')).toBe(DYNAMIC_OG_CACHE_CONTROL)
  })

  it('leaves non-200 responses untouched', () => {
    const { event, res } = createMockEvent('/_og/d/invalid.png', 404, {
      'content-type': 'image/png',
      'vary': 'accept-encoding',
      'cache-control': 'public, max-age=300, s-maxage=300',
    })

    normalizeOgImageResponseHeaders(event)

    expect(res.getHeader('vary')).toBe('accept-encoding')
    expect(res.getHeader('cache-control')).toBe('public, max-age=300, s-maxage=300')
  })

  it('leaves non-image and non-/_og/d responses untouched', () => {
    const nonImage = createMockEvent('/_og/d/c_Splash.takumi.html', 200, {
      'content-type': 'text/html',
      'vary': 'accept-encoding',
      'cache-control': 'no-cache',
    })
    normalizeOgImageResponseHeaders(nonImage.event)
    expect(nonImage.res.getHeader('vary')).toBe('accept-encoding')

    const otherPath = createMockEvent('/api/registry/image-proxy', 200, {
      'content-type': 'image/png',
      'vary': 'accept-encoding',
      'cache-control': 'public, max-age=3600',
    })
    normalizeOgImageResponseHeaders(otherPath.event)
    expect(otherPath.res.getHeader('vary')).toBe('accept-encoding')
    expect(otherPath.res.getHeader('cache-control')).toBe('public, max-age=3600')
  })
})
