import { Constellation } from '#shared/utils/constellation'
import { NPMX_SITE } from '#shared/utils/constants'

const BLOG_BACKLINK_TTL_IN_SECONDS = 60 * 5

// TODO: Remove did when going live
const TESTING_ROE_DID = 'did:plc:jbeaa5kdaladzwq3r7f5xgwe'
// const TESTING_BACKLINK_URL = 'https://roe.dev/blog/the-golden-thread'
// const NPMX_DID = 'did:plc:u5zp7npt5kpueado77kuihyz'

/**
 * @public
 */
export interface BlogPostBlueskyLink {
  did: string
  rkey: string
  postUri: string
}

/**
 * @public
 */
export function useBlogPostBlueskyLink(slug: MaybeRefOrGetter<string | null | undefined>) {
  const cachedFetch = useCachedFetch()

  const blogUrl = computed(() => {
    const s = toValue(slug)
    if (!s) return null
    return `${NPMX_SITE}/blog/${s}`
    // return TESTING_BACKLINK_URL
  })

  return useAsyncData<BlogPostBlueskyLink | null>(
    () => (blogUrl.value ? `blog-bsky-link:${blogUrl.value}` : 'blog-bsky-link:none'),
    async () => {
      const url = blogUrl.value
      if (!url) return null

      const constellation = new Constellation(cachedFetch)

      try {
        // Try embed.external.uri first (link card embeds)
        const { data: embedBacklinks } = await constellation.getBackLinks(
          url,
          'app.bsky.feed.post',
          'embed.external.uri',
          1,
          undefined,
          true,
          [[TESTING_ROE_DID]],
          BLOG_BACKLINK_TTL_IN_SECONDS,
        )

        const embedRecord = embedBacklinks.records[0]
        if (embedRecord) {
          return {
            did: embedRecord.did,
            rkey: embedRecord.rkey,
            postUri: `at://${embedRecord.did}/app.bsky.feed.post/${embedRecord.rkey}`,
          }
        }

        // Try facets.features.uri (URLs in post text)
        const { data: facetBacklinks } = await constellation.getBackLinks(
          url,
          'app.bsky.feed.post',
          'facets[].features[app.bsky.richtext.facet#link].uri',
          1,
          undefined,
          true,
          [[TESTING_ROE_DID]],
          BLOG_BACKLINK_TTL_IN_SECONDS,
        )

        const facetRecord = facetBacklinks.records[0]
        if (facetRecord) {
          return {
            did: facetRecord.did,
            rkey: facetRecord.rkey,
            postUri: `at://${facetRecord.did}/app.bsky.feed.post/${facetRecord.rkey}`,
          }
        }
      } catch (error: unknown) {
        // Constellation unavailable or error - fail silently
        // But during dev we will get an error
        if (import.meta.dev) console.error('[Bluesky] Constellation error:', error)
      }

      return null
    },
  )
}
