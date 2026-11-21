import { describe, expect, it, vi } from 'vite-plus/test'

vi.mock('nuxt/kit', () => ({
  addTemplate: vi.fn(),
  defineNuxtModule: <T>(module: T) => module,
}))

import { getVercelAnalyticsConfig } from '../../../modules/vercel-analytics'

describe('getVercelAnalyticsConfig', () => {
  it('reads the analytics paths from the Vercel client config as absolute paths', () => {
    const clientConfig = JSON.stringify({
      analytics: {
        scriptSrc: 'abc/script.js',
        viewEndpoint: 'abc/view',
        eventEndpoint: 'abc/event',
        sessionEndpoint: '/abc/session',
      },
      speedInsights: { scriptSrc: 'def/script.js', endpoint: 'def/vitals' },
    })

    expect(getVercelAnalyticsConfig(clientConfig)).toEqual({
      scriptSrc: '/abc/script.js',
      viewEndpoint: '/abc/view',
      eventEndpoint: '/abc/event',
      sessionEndpoint: '/abc/session',
    })
  })

  it('returns no paths without a valid client config', () => {
    expect(getVercelAnalyticsConfig(undefined)).toEqual({})
    expect(getVercelAnalyticsConfig('not json')).toEqual({})
  })
})
