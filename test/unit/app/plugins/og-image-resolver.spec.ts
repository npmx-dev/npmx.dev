import { describe, expect, it, vi } from 'vite-plus/test'

vi.stubGlobal('defineNuxtPlugin', <T>(fn: T) => fn)

const { dropResolverOgImageTags } = await import('../../../../app/plugins/og-image-resolver.client')

const meta = (props: Record<string, unknown>) => ({ tag: 'meta', props })

describe('dropResolverOgImageTags', () => {
  it('drops og:image and twitter:image tags when they point at the resolver', () => {
    const tags = [
      { tag: 'title', props: {} },
      meta({ property: 'og:image', content: 'https://npmx.dev/_og/r/package/vue.png' }),
      meta({ property: 'og:image:width', content: '1200' }),
      meta({ name: 'twitter:image', content: 'https://npmx.dev/_og/r/package/vue.png' }),
      meta({ name: 'twitter:card', content: 'summary_large_image' }),
      meta({ name: 'description', content: 'vue' }),
    ]

    expect(dropResolverOgImageTags(tags)).toEqual([
      { tag: 'title', props: {} },
      meta({ name: 'twitter:card', content: 'summary_large_image' }),
      meta({ name: 'description', content: 'vue' }),
    ])
  })

  it('keeps image tags that point at served OG URLs', () => {
    const tags = [
      meta({ property: 'og:image', content: 'https://npmx.dev/_og/s/o_b3102e4ed8a75bd7.png' }),
      meta({ property: 'og:image:width', content: '1200' }),
      meta({ name: 'twitter:image', content: 'https://npmx.dev/_og/d/c_Package.takumi.png' }),
    ]

    expect(dropResolverOgImageTags(tags)).toEqual(tags)
  })
})
