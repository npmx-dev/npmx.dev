import { array, boolean, custom, isoTimestamp, object, optional, pipe, string } from 'valibot'
import { isAtIdentifierString, type AtIdentifierString } from '@atproto/lex'
import type { InferOutput } from 'valibot'

export const AuthorSchema = object({
  name: string(),
  blueskyHandle: optional(
    pipe(
      string(),
      custom<AtIdentifierString>(v => typeof v === 'string' && isAtIdentifierString(v)),
    ),
  ),
})

export const BlogPostSchema = object({
  authors: array(AuthorSchema),
  title: string(),
  date: pipe(string(), isoTimestamp()),
  description: string(),
  path: string(),
  slug: string(),
  excerpt: optional(string()),
  tags: optional(array(string())),
  draft: optional(boolean()),
})

export type Author = InferOutput<typeof AuthorSchema>

export interface ResolvedAuthor extends Author {
  avatar: string | null
  profileUrl: string | null
}

/**
 * Inferred type for blog post frontmatter
 */
/** @public */
export type BlogPostFrontmatter = InferOutput<typeof BlogPostSchema>
