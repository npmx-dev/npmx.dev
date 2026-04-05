import type * as app from '#shared/types/lexicons/app'

export type CommentEmbed =
  | { type: 'images'; images: app.bsky.embed.images.ViewImage[] }
  | { type: 'external'; external: app.bsky.embed.external.ViewExternal }

export interface Comment {
  uri: string
  cid: string
  author: Pick<app.bsky.actor.defs.ProfileViewBasic, 'did' | 'handle' | 'displayName' | 'avatar'>
  text: string
  facets?: app.bsky.richtext.facet.Main[]
  embed?: CommentEmbed
  createdAt: string
  likeCount: number
  replyCount: number
  repostCount: number
  replies: Comment[]
}

/*
  WARN: FederatedArticleInput specifics
  interface - All strings must be captured in single quotes in order to be parsed correctly in the MD file
  authorHandle - Must not contain `@` symbol prefix
  description - Any additional single quotes must be properly escaped with a `\`
*/
export interface FederatedArticleInput {
  url: string
  title: string
  authorHandle: string
  description: string
}
