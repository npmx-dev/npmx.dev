import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useNuxt } = vi.hoisted(() => ({
  useNuxt: vi.fn(),
}))

vi.mock('nuxt/kit', () => ({
  defineNuxtModule: <T>(module: T) => module,
  useNuxt,
}))

import securityHeadersModule from '../../../modules/security-headers'

type RouteRule = {
  headers?: Record<string, string>
  redirect?: string
}

type MockNuxt = {
  options: {
    app: {
      head?: {
        meta?: Array<Record<string, string>>
      }
    }
    dev: boolean
    devtools?: boolean | { enabled?: boolean }
    routeRules: Record<string, RouteRule>
  }
}

function createNuxt(options: Partial<MockNuxt['options']> = {}): MockNuxt {
  return {
    options: {
      app: {},
      dev: false,
      devtools: false,
      routeRules: {},
      ...options,
    },
  }
}

function getCsp(nuxt: MockNuxt) {
  return nuxt.options.app.head?.meta?.find(meta => meta['http-equiv'] === 'Content-Security-Policy')
    ?.content
}

describe('security headers module', () => {
  beforeEach(() => {
    delete process.env.TEST
    useNuxt.mockReset()
  })

  it('keeps security headers and only relaxes devtools-specific bits in dev', () => {
    const nuxt = createNuxt({
      dev: true,
      devtools: { enabled: true },
      routeRules: {
        '/**': {
          headers: {
            'Permissions-Policy': 'camera=()',
          },
        },
        '/__nuxt_devtools__/**': {
          headers: {
            'Cache-Control': 'no-store',
          },
          redirect: '/devtools',
        },
      },
    })

    useNuxt.mockReturnValue(nuxt)
    securityHeadersModule.setup()

    const csp = getCsp(nuxt)

    expect(csp).toContain('ws://localhost:*')
    expect(csp).toContain("frame-src https://bsky.app https://pdsmoover.com 'self'")
    expect(nuxt.options.routeRules['/**']?.headers).toEqual(
      expect.objectContaining({
        'Permissions-Policy': 'camera=()',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      }),
    )
    expect(nuxt.options.routeRules['/__nuxt_devtools__/**']).toEqual({
      headers: {
        'Cache-Control': 'no-store',
        'Permissions-Policy': 'camera=()',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
      },
      redirect: '/devtools',
    })
  })

  it('does not apply devtools relaxations when devtools are disabled via object config', () => {
    const nuxt = createNuxt({
      dev: true,
      devtools: { enabled: false },
    })

    useNuxt.mockReturnValue(nuxt)
    securityHeadersModule.setup()

    const csp = getCsp(nuxt)

    expect(csp).not.toContain('ws://localhost:*')
    expect(csp).not.toContain("frame-src https://bsky.app https://pdsmoover.com 'self'")
    expect(nuxt.options.routeRules['/__nuxt_devtools__/**']).toBeUndefined()
  })
})
