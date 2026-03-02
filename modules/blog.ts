import { join } from 'node:path'
import Markdown from 'unplugin-vue-markdown/vite'
import { addTemplate, addVitePlugin, defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import shiki from '@shikijs/markdown-exit'
import MarkdownItAnchor from 'markdown-it-anchor'
import { defu } from 'defu'
import { read } from 'gray-matter'
import { safeParse } from 'valibot'
import { BlogPostSchema, type BlogPostFrontmatter } from '../shared/schemas/blog'
import { globSync } from 'tinyglobby'
import { isProduction } from '../config/env'

/**
 * Scans the blog directory for .md files and extracts validated frontmatter.
 * Returns all posts (including drafts) sorted by date descending.
 */
function loadBlogPosts(blogDir: string): BlogPostFrontmatter[] {
  const files: string[] = globSync(join(blogDir, '*.md'))

  const posts: BlogPostFrontmatter[] = []

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

    const result = safeParse(BlogPostSchema, frontmatter)
    if (!result.success) continue

    posts.push(result.output)
  }

  // Sort newest first
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return posts
}

export default defineNuxtModule({
  meta: {
    name: 'blog',
  },
  setup() {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)
    const blogDir = resolver.resolve('../app/pages/blog')

    nuxt.options.extensions.push('.md')
    nuxt.options.vite.vue = defu(nuxt.options.vite.vue, {
      include: [/\.vue($|\?)/, /\.(md|markdown)($|\?)/],
    })

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

    // Expose frontmatter for the `/blog` listing page.
    const showDrafts = nuxt.options.dev || !isProduction
    addTemplate({
      filename: 'blog/posts.ts',
      write: true,
      getContents: () => {
        const posts = loadBlogPosts(blogDir).filter(p => showDrafts || !p.draft)
        return [
          `import type { BlogPostFrontmatter } from '#shared/schemas/blog'`,
          ``,
          `export const posts: BlogPostFrontmatter[] = ${JSON.stringify(posts, null, 2)}`,
        ].join('\n')
      },
    })

    nuxt.options.alias['#blog/posts'] = join(nuxt.options.buildDir, 'blog/posts')

    // Add X-Robots-Tag header for draft posts to prevent indexing
    const posts = loadBlogPosts(blogDir)
    for (const post of posts) {
      if (post.draft) {
        nuxt.options.routeRules ||= {}
        nuxt.options.routeRules[`/blog/${post.slug}`] = {
          headers: { 'X-Robots-Tag': 'noindex, nofollow' },
        }
      }
    }
  },
})
