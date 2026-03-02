import { join } from 'node:path'
import Markdown from 'unplugin-vue-markdown/vite'
import { addTemplate, addVitePlugin, defineNuxtModule, useNuxt, createResolver } from 'nuxt/kit'
import shiki from '@shikijs/markdown-it'
import MarkdownItAnchor from 'markdown-it-anchor'
import { defu } from 'defu'
import { read } from 'gray-matter'
import { safeParse } from 'valibot'
import { BlogPostSchema, type BlogPostFrontmatter } from '../shared/schemas/blog'
import { globSync } from 'tinyglobby'
import { isProduction } from '../config/env'

/**
 * Scans the blog directory for .md files and extracts validated frontmatter.
 * Returns only non-draft posts sorted by date descending.
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

    if (result.output.draft) continue

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
        async markdownItSetup(md) {
          md.use(
            await shiki({
              themes: {
                dark: 'github-dark',
                light: 'github-light',
              },
            }),
          )
          md.use(MarkdownItAnchor)
        },
      }),
    )

    // Expose frontmatter for published posts to avoid bundling the full content
    // of all posts in `/blog` page.
    addTemplate({
      filename: 'blog/posts.ts',
      write: true,
      getContents: () => {
        const posts = loadBlogPosts(blogDir)
        return [
          `import type { BlogPostFrontmatter } from '#shared/schemas/blog'`,
          ``,
          `export const posts: BlogPostFrontmatter[] = ${JSON.stringify(posts, null, 2)}`,
        ].join('\n')
      },
    })

    nuxt.options.alias['#blog/posts'] = join(nuxt.options.buildDir, 'blog/posts')

    // In production, remove page routes for draft posts
    if (!nuxt.options.dev && isProduction) {
      const publishedPosts = loadBlogPosts(blogDir)
      const publishedSlugs = new Set(publishedPosts.map(p => p.slug))

      nuxt.hook('pages:extend', pages => {
        // Walk the pages tree and remove draft blog post pages
        for (let i = pages.length - 1; i >= 0; i--) {
          const page = pages[i]!
          // Blog post pages are at /blog/<slug> — the file is blog/<slug>.md
          if (page.file?.endsWith('.md') && page.file?.includes('/blog/')) {
            // Extract the slug from the filename
            const filename = page.file.split('/').pop()?.replace('.md', '')
            if (filename && filename !== 'index' && !publishedSlugs.has(filename)) {
              pages.splice(i, 1)
            }
          }
        }
      })
    }
  },
})
