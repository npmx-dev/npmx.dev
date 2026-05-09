import {
  array,
  boolean,
  custom,
  isoTimestamp,
  nullable,
  object,
  optional,
  pipe,
  string,
} from 'valibot'
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

export const ResolvedAuthorSchema = object({
  name: string(),
  blueskyHandle: optional(
    pipe(
      string(),
      custom<AtIdentifierString>(v => typeof v === 'string' && isAtIdentifierString(v)),
    ),
  ),
  avatar: nullable(string()),
  profileUrl: nullable(string()),
})

/** Schema for raw frontmatter as defined in markdown YAML */
export const RawBlogPostSchema = object({
  authors: array(AuthorSchema),
  title: string(),
  date: pipe(string(), isoTimestamp()),
  description: string(),
  path: string(),
  slug: string(),
  excerpt: optional(string()),
  tags: optional(array(string())),
  draft: optional(boolean()),
  image: optional(string()),
})

/** Schema for blog post frontmatter with resolved author data (avatars, profile URLs) */
export const BlogPostSchema = object({
  authors: array(ResolvedAuthorSchema),
  title: string(),
  date: pipe(string(), isoTimestamp()),
  description: string(),
  path: string(),
  slug: string(),
  excerpt: optional(string()),
  tags: optional(array(string())),
  draft: optional(boolean()),
  image: optional(string()),
})

export type Author = InferOutput<typeof AuthorSchema>

export type ResolvedAuthor = InferOutput<typeof ResolvedAuthorSchema>

/** Raw frontmatter type (before avatar resolution) */
export type RawBlogPostFrontmatter = InferOutput<typeof RawBlogPostSchema>

/**
 * Inferred type for blog post frontmatter
 */
export type BlogPostFrontmatter = InferOutput<typeof BlogPostSchema>
