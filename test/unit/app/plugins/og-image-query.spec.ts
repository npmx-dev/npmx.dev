import { describe, expect, it, vi } from 'vite-plus/test'

vi.stubGlobal('defineNuxtPlugin', <T>(fn: T) => fn)

const { stripOgImageQuery } = await import('../../../../app/plugins/og-image-query.server')

describe('stripOgImageQuery', () => {
  it('removes _query from non-screenshot OG image payloads', () => {
    const options: Record<string, unknown> = {
      component: 'Package.takumi',
      props: { name: 'vue' },
      _query: { activeTab: 'readme', utm_source: 'bsky' },
    }
    const ssrContext = {
      _ogImagePayloads: [['og', options, '/package/vue']],
    }

    stripOgImageQuery(ssrContext)

    expect(options).not.toHaveProperty('_query')
    expect(options.props).toEqual({ name: 'vue' })
  })

  it('keeps _query for PageScreenshot payloads', () => {
    const options: Record<string, unknown> = {
      component: 'PageScreenshot',
      _query: { theme: 'dark' },
    }
    const ssrContext = {
      _ogImagePayloads: [['og', options, '/preview']],
    }

    stripOgImageQuery(ssrContext)

    expect(options).toHaveProperty('_query', { theme: 'dark' })
  })

  it('handles missing ssrContext or empty payloads', () => {
    expect(() => stripOgImageQuery(undefined)).not.toThrow()
    expect(() => stripOgImageQuery({})).not.toThrow()
  })
})
