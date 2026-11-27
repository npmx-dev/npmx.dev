import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BlueskyPostEmbed from '~/components/global/BlueskyPostEmbed.vue'

const uri = 'at://did:plc:2gkh62xvzokhlf6li4ol3b3d/app.bsky.feed.post/3md3cmrg56k2r'
const key = `bsky-post-${uri}`

describe('BlueskyPostEmbed', () => {
  afterEach(() => {
    const nuxtApp = useNuxtApp()
    nuxtApp.isHydrating = false
    nuxtApp.payload.serverRendered = false
    clearNuxtData(key)
    vi.unstubAllGlobals()
  })

  it('fetches the post again after hydrating a server error', async () => {
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.serverRendered = true
    // oxlint-disable-next-line eslint/no-underscore-dangle
    nuxtApp.payload._errors[key] = createError('Bluesky unavailable')
    nuxtApp.isHydrating = true

    vi.stubGlobal(
      '$fetch',
      vi.fn(async () => ({
        posts: [
          {
            uri,
            author: { did: 'did:plc:2gkh62xvzokhlf6li4ol3b3d', handle: 'danielroe.dev' },
            record: { text: 'Fetched after hydration', createdAt: '2026-03-03T12:00:00.000Z' },
          },
        ],
      })),
    )

    const component = await mountSuspended(BlueskyPostEmbed, { props: { uri } })
    nuxtApp.isHydrating = false

    await vi.waitFor(() => expect(component.text()).toContain('Fetched after hydration'))
  })
})
