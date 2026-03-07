import { join } from 'node:path'
import Markdown from 'unplugin-vue-markdown/vite'
import { addTemplate, addVitePlugin, defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import shiki from '@shikijs/markdown-exit'
import MarkdownItAnchor from 'markdown-it-anchor'
import { defu } from 'defu'
import { read } from 'gray-matter'
import { array, safeParse } from 'valibot'
import {
  AuthorSchema,
  RawBlogPostSchema,
  type Author,
  type BlogPostFrontmatter,
  type ResolvedAuthor,
} from '../shared/schemas/blog'
import { globSync } from 'tinyglobby'
import { isProduction } from '../config/env'
import { BLUESKY_API } from '../shared/utils/constants'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import crypto from 'node:crypto'

/**
 * Fetches Bluesky avatars for a set of authors at build time.
 * Returns a map of handle → avatar URL.
 */
async function fetchBlueskyAvatars(
  imagesDir: string,
  handles: string[],
): Promise<Map<string, string>> {
  const avatarMap = new Map<string, string>()
  if (handles.length === 0) return avatarMap

  try {
    const params = new URLSearchParams()
    for (const handle of handles) {
      params.append('actors', handle)
    }

    const response = await fetch(
      `${BLUESKY_API}/xrpc/app.bsky.actor.getProfiles?${params.toString()}`,
    )

    if (!response.ok) {
      console.warn(`[blog] Failed to fetch Bluesky profiles: ${response.status}`)
      return avatarMap
    }

    const data = (await response.json()) as { profiles: Array<{ handle: string; avatar?: string }> }

    for (const profile of data.profiles) {
      if (profile.avatar) {
        const hash = crypto.createHash('sha256').update(profile.avatar).digest('hex')
        const dest = join(imagesDir, `${hash}.png`)

        if (!existsSync(dest)) {
          const res = await fetch(`${profile.avatar}@png`)
          await writeFile(join(imagesDir, `${hash}.png`), res.body!)
        }

        avatarMap.set(profile.handle, `/blog/avatar/${hash}.png`)
      }
    }
  } catch (error) {
    console.warn(`[blog] Failed to fetch Bluesky avatars:`, error)
  }

  return avatarMap
}

/**
 * Resolves authors with their Bluesky avatars and profile URLs.
 */
function resolveAuthors(authors: Author[], avatarMap: Map<string, string>): ResolvedAuthor[] {
  return authors.map(author => ({
    ...author,
    avatar: author.blueskyHandle ? (avatarMap.get(author.blueskyHandle) ?? null) : null,
    profileUrl: author.blueskyHandle ? `https://bsky.app/profile/${author.blueskyHandle}` : null,
  }))
}

/**
 * Scans the blog directory for .md files and extracts validated frontmatter.
 * Returns all posts (including drafts) sorted by date descending.
 * Resolves Bluesky avatars at build time.
 */
async function loadBlogPosts(blogDir: string, imagesDir: string): Promise<BlogPostFrontmatter[]> {
  const files: string[] = globSync(join(blogDir, '*.md').replace(/\\/g, '/'))

  // First pass: extract raw frontmatter and collect all Bluesky handles
  const rawPosts: Array<{ frontmatter: Record<string, unknown> }> = []
  const allHandles = new Set<string>()

  for (const file of files) {
    const { data: frontmatter } = read(file)

    // Normalise slug → path (same logic as standard-site-sync)
    if (typeof frontmatter.slug === 'string' && !frontmatter.path) {
      frontmatter.path = `/blog/${frontmatter.slug}`
    }
    // Normalise date to ISO string
    if (frontmatter.date) {
      const raw = frontmatter.date
      frontmatter.date = new Date(raw instanceof Date ? raw : String(raw)).toISOString()
    }

    // Validate authors before resolving so we can extract handles
    const authorsResult = safeParse(array(AuthorSchema), frontmatter.authors)
    if (authorsResult.success) {
      for (const author of authorsResult.output) {
        if (author.blueskyHandle) {
          allHandles.add(author.blueskyHandle)
        }
      }
    }

    rawPosts.push({ frontmatter })
  }

  // Batch-fetch all Bluesky avatars in a single request
  const avatarMap = await fetchBlueskyAvatars(imagesDir, [...allHandles])

  // Second pass: validate with raw schema, then enrich authors with avatars
  const posts: BlogPostFrontmatter[] = []

  for (const { frontmatter } of rawPosts) {
    const result = safeParse(RawBlogPostSchema, frontmatter)
    if (!result.success) continue

    posts.push({
      ...result.output,
      authors: resolveAuthors(result.output.authors, avatarMap),
    })
  }

  // Sort newest first
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return posts
}

export default defineNuxtModule({
  meta: {
    name: 'blog',
  },
  async setup() {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)
    const blogDir = resolver.resolve('../app/pages/blog')
    const blogImagesDir = resolver.resolve('../public/blog/avatar')

    nuxt.options.extensions.push('.md')
    nuxt.options.vite.vue = defu(nuxt.options.vite.vue, {
      include: [/\.vue($|\?)/, /\.(md|markdown)($|\?)/],
    })

    if (!existsSync(blogImagesDir)) {
      await mkdir(blogImagesDir, { recursive: true })
    }

    addVitePlugin(() =>
      Markdown({
        include: [/\.(md|markdown)($|\?)/],
        wrapperComponent: 'BlogPostWrapper',
        wrapperClasses: 'text-fg-muted leading-relaxed',
        async markdownSetup(md) {
          md.use(
            await shiki({
              themes: {
                dark: 'github-dark',
                light: 'github-light',
              },
            }),
          )
          md.use(MarkdownItAnchor as any)
        },
      }),
    )

    // Load posts once with resolved Bluesky avatars (shared across template + route rules)
    const allPosts = await loadBlogPosts(blogDir, blogImagesDir)

    // Expose frontmatter for the `/blog` listing page.
    const showDrafts = nuxt.options.dev || !isProduction
    addTemplate({
      filename: 'blog/posts.ts',
      write: true,
      getContents: () => {
        const posts = allPosts.filter(p => showDrafts || !p.draft)
        return [
          `import type { BlogPostFrontmatter } from '#shared/schemas/blog'`,
          ``,
          `export const posts: BlogPostFrontmatter[] = ${JSON.stringify(posts, null, 2)}`,
        ].join('\n')
      },
    })

    nuxt.options.alias['#blog/posts'] = join(nuxt.options.buildDir, 'blog/posts')

    // Add X-Robots-Tag header for draft posts to prevent indexing
    for (const post of allPosts) {
      if (post.draft) {
        nuxt.options.routeRules ||= {}
        nuxt.options.routeRules[`/blog/${post.slug}`] = {
          headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        }
      }
    }
  },
})
