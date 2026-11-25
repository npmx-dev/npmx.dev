interface HeadTag {
  tag: string
  props: Record<string, unknown>
}

const RESOLVER_URL_RE = /\/_og\/r(?:\/|\.png)/

function isImageMeta(tag: HeadTag): boolean {
  if (tag.tag !== 'meta') return false
  const property = tag.props.property
  const name = tag.props.name
  return (
    (typeof property === 'string' && property.startsWith('og:image')) ||
    (typeof name === 'string' && name.startsWith('twitter:image'))
  )
}

export function dropResolverOgImageTags(tags: HeadTag[]): HeadTag[] {
  const usesResolver = tags.some(
    tag =>
      isImageMeta(tag) &&
      typeof tag.props.content === 'string' &&
      RESOLVER_URL_RE.test(tag.props.content),
  )
  return usesResolver ? tags.filter(tag => !isImageMeta(tag)) : tags
}

export default defineNuxtPlugin(nuxtApp => {
  if (import.meta.dev) return

  nuxtApp.vueApp.runWithContext(() => {
    injectHead().use({
      key: 'npmx:og-image-resolver',
      hooks: {
        'tags:afterResolve': ctx => {
          ctx.tags = dropResolverOgImageTags(ctx.tags as HeadTag[]) as typeof ctx.tags
        },
      },
    })
  })
})
