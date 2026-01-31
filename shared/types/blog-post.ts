import type {
  AppBskyActorDefs,
  AppBskyRichtextFacet,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
} from '@atproto/api'

export interface BlogPost {
  author: string // Potentially Multiple?
  title: string
  topics: string[]
  content: string // MarkDown File
  published: string // DateTime
}

export interface CommentEmbed {
  type: 'images' | 'external'
  images?: AppBskyEmbedImages.ViewImage[]
  external?: AppBskyEmbedExternal.ViewExternal
}

export interface Comment {
  uri: string
  cid: string
  author: Pick<AppBskyActorDefs.ProfileViewBasic, 'did' | 'handle' | 'displayName' | 'avatar'>
  text: string
  facets?: AppBskyRichtextFacet.Main[]
  embed?: CommentEmbed
  createdAt: string
  likeCount: number
  replyCount: number
  repostCount: number
  replies: Comment[]
}
