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
