import type { ReadmeResponse, TocItem } from '#shared/types/readme'
import type { Tokens } from 'marked'
import matter from 'gray-matter'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'
import { convertBlobOrFileToRawUrl, type RepositoryInfo } from '#shared/utils/git-providers'
import { decodeHtmlEntities, stripHtmlTags } from '#shared/utils/html'
import { convertToEmoji } from '#shared/utils/emoji'
import { toProxiedImageUrl } from '#server/utils/image-proxy'

import { highlightCodeSync } from './shiki'
import { escapeHtml } from './docs/text'

/**
 * Playground provider configuration
 */
interface PlaygroundProvider {
  id: string // Provider identifier
  name: string
  domains: string[] // Associated domains
  paths?: string[]
  icon?: string // Provider icon name
}

/**
 * Known playground/demo providers
 */
const PLAYGROUND_PROVIDERS: PlaygroundProvider[] = [
  {
    id: 'stackblitz',
    name: 'StackBlitz',
    domains: ['stackblitz.com', 'stackblitz.io'],
    icon: 'stackblitz',
  },
  {
    id: 'codesandbox',
    name: 'CodeSandbox',
    domains: ['codesandbox.io', 'githubbox.com', 'csb.app'],
    icon: 'codesandbox',
  },
  {
    id: 'codepen',
    name: 'CodePen',
    domains: ['codepen.io'],
    icon: 'codepen',
  },
  {
    id: 'jsfiddle',
    name: 'JSFiddle',
    domains: ['jsfiddle.net'],
    icon: 'jsfiddle',
  },
  {
    id: 'replit',
    name: 'Replit',
    domains: ['repl.it', 'replit.com'],
    icon: 'replit',
  },
  {
    id: 'gitpod',
    name: 'Gitpod',
    domains: ['gitpod.io'],
    icon: 'gitpod',
  },
  {
    id: 'vue-playground',
    name: 'Vue Playground',
    domains: ['play.vuejs.org', 'sfc.vuejs.org'],
    icon: 'vue',
  },
  {
    id: 'nuxt-new',
    name: 'Nuxt Starter',
    domains: ['nuxt.new'],
    icon: 'nuxt',
  },
  {
    id: 'vite-new',
    name: 'Vite Starter',
    domains: ['vite.new'],
    icon: 'vite',
  },
  {
    id: 'typescript-playground',
    name: 'TypeScript Playground',
    domains: ['typescriptlang.org'],
    paths: ['/play'],
    icon: 'typescript',
  },
  {
    id: 'solid-playground',
    name: 'Solid Playground',
    domains: ['playground.solidjs.com'],
    icon: 'solid',
  },
  {
    id: 'svelte-playground',
    name: 'Svelte Playground',
    domains: ['svelte.dev'],
    paths: ['/repl', '/playground'],
    icon: 'svelte',
  },
  {
    id: 'tailwind-playground',
    name: 'Tailwind Play',
    domains: ['play.tailwindcss.com'],
    icon: 'tailwindcss',
  },
  {
    id: 'marko-playground',
    name: 'Marko Playground',
    domains: ['markojs.com'],
    paths: ['/playground'],
    icon: 'marko',
  },
]

/**
 * Check if a URL is a playground link and return provider info
 */
function matchPlaygroundProvider(url: string): PlaygroundProvider | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    for (const provider of PLAYGROUND_PROVIDERS) {
      for (const domain of provider.domains) {
        if (
          (hostname === domain || hostname.endsWith(`.${domain}`)) &&
          (!provider.paths || provider.paths.some(path => parsed.pathname.startsWith(path)))
        ) {
          return provider
        }
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

// allow h1-h6, but replace h1-h2 later since we shift README headings down by 2 levels
// (page h1 = package name, h2 = "Readme" section, so README h1 → h3)
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'strong',
  'em',
  'del',
  's',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'picture',
  'source',
  'details',
  'summary',
  'div',
  'span',
  'sup',
  'sub',
  'kbd',
  'mark',
  'button',
]

const ALLOWED_ATTR: Record<string, string[]> = {
  '*': ['id'], // Allow id on all tags
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'align'],
  'source': ['src', 'srcset', 'type', 'media'],
  'button': ['class', 'title', 'type', 'aria-label', 'data-copy'],
  'th': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'td': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'h3': ['data-level', 'align'],
  'h4': ['data-level', 'align'],
  'h5': ['data-level', 'align'],
  'h6': ['data-level', 'align'],
  'blockquote': ['data-callout'],
  'details': ['open'],
  'code': ['class'],
  'pre': ['class', 'style'],
  'span': ['class', 'style'],
  'div': ['class', 'style', 'align'],
  'p': ['align'],
}

/**
 * Generate a GitHub-style slug from heading text.
 * - Convert to lowercase
 * - Remove HTML tags
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric, hyphens, underscores)
 * - Collapse multiple hyphens
 */
function slugify(text: string): string {
  return decodeHtmlEntities(stripHtmlTags(text))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '') // Keep alphanumeric, CJK, hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}

function getHeadingPlainText(text: string): string {
  return decodeHtmlEntities(stripHtmlTags(text).trim())
}

function getHeadingSlugSource(text: string): string {
  return stripHtmlTags(text).trim()
}

/**
 * Lazy ATX heading extension for marked: allows headings without a space after `#`.
 *
 * Reimplements the behavior of markdown-it-lazy-headers
 * (https://npmx.dev/package/markdown-it-lazy-headers), which is used by npm's own markdown renderer
 * marky-markdown (https://npmx.dev/package/marky-markdown).
 *
 * CommonMark requires a space after # for ATX headings, but many READMEs in the npm registry omit
 * this space. This extension allows marked to parse these headings the same way npm does.
 */
marked.use({
  tokenizer: {
    heading(src: string) {
      // Only match headings where `#` is immediately followed by non-whitespace, non-`#` content.
      // Normal headings (with space) return false to fall through to marked's default tokenizer.
      const match = /^ {0,3}(#{1,6})([^\s#][^\n]*)(?:\n+|$)/.exec(src)
      if (!match) return false

      let text = match[2]!.trim()

      // Strip trailing # characters only if preceded by a space (CommonMark behavior).
      // e.g., "#heading ##" → "heading", but "#heading#" stays as "heading#"
      if (text.endsWith('#')) {
        const stripped = text.replace(/#+$/, '')
        if (!stripped || stripped.endsWith(' ')) {
          text = stripped.trim()
        }
      }

      return {
        type: 'heading' as const,
        raw: match[0]!,
        depth: match[1]!.length as number,
        text,
        tokens: this.lexer.inline(text),
      }
    },
  },
})

/** These path on npmjs.com don't belong to packages or search, so we shouldn't try to replace them with npmx.dev urls */
const reservedPathsNpmJs = [
  'products',
  'login',
  'signup',
  'advisories',
  'blog',
  'about',
  'press',
  'policies',
]

const npmJsHosts = new Set(['www.npmjs.com', 'npmjs.com', 'www.npmjs.org', 'npmjs.org'])

const USER_CONTENT_PREFIX = 'user-content-'

function withUserContentPrefix(value: string): string {
  return value.startsWith(USER_CONTENT_PREFIX) ? value : `${USER_CONTENT_PREFIX}${value}`
}

function toUserContentId(value: string): string {
  return `${USER_CONTENT_PREFIX}${value}`
}

function toUserContentHash(value: string): string {
  return `#${withUserContentPrefix(value)}`
}

function normalizePreservedAnchorAttrs(attrs: string): string {
  const cleanedAttrs = attrs
    .replace(/\s+href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+rel\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+target\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim()

  return cleanedAttrs ? ` ${cleanedAttrs}` : ''
}

const isNpmJsUrlThatCanBeRedirected = (url: URL) => {
  if (!npmJsHosts.has(url.host)) {
    return false
  }

  if (
    url.pathname === '/' ||
    reservedPathsNpmJs.some(path => url.pathname.startsWith(`/${path}`))
  ) {
    return false
  }

  return true
}

/**
 * Resolve a relative URL to an absolute URL.
 * If repository info is available, resolve to provider's raw file URLs.
 * For markdown files (.md), use blob URLs so they render properly.
 * Otherwise, fall back to jsdelivr CDN (except for .md files which are left unchanged).
 */
function resolveUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  if (!url) return url
  if (url.startsWith('#')) {
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    // Idempotent: don't double-prefix if already prefixed
    return toUserContentHash(url.slice(1))
  }
  // Absolute paths (e.g. /package/foo from a previous npmjs redirect) are already resolved
  if (url.startsWith('/')) return url
  if (hasProtocol(url, { acceptRelative: true })) {
    try {
      const parsed = new URL(url, 'https://example.com')
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Redirect npmjs urls to ourself
        if (isNpmJsUrlThatCanBeRedirected(parsed)) {
          return parsed.pathname + parsed.search + parsed.hash
        }
        return url
      }
    } catch {
      // Invalid URL, fall through to resolve as relative
    }
    // return protocol-relative URLs (//example.com) as-is
    if (url.startsWith('//')) {
      return url
    }
    // for non-HTTP protocols (javascript:, data:, etc.), don't return, treat as relative
  }

  // Check if this is a markdown file link
  const isMarkdownFile = /\.md$/i.test(url.split('?')[0]?.split('#')[0] ?? '')

  // Use provider's URL base when repository info is available
  // This handles assets that exist in the repo but not in the npm tarball
  if (repoInfo?.rawBaseUrl) {
    // Normalize the relative path (remove leading ./)
    let relativePath = url.replace(/^\.\//, '')

    // If package is in a subdirectory, resolve relative paths from there
    // e.g., for packages/ai with ./assets/hero.gif → packages/ai/assets/hero.gif
    // but for ../../.github/assets/banner.jpg → resolve relative to subdirectory
    if (repoInfo.directory) {
      // Split directory into parts for relative path resolution
      const dirParts = repoInfo.directory.split('/').filter(Boolean)

      // Handle ../ navigation
      while (relativePath.startsWith('../')) {
        relativePath = relativePath.slice(3)
        dirParts.pop()
      }

      // Reconstruct the path
      if (dirParts.length > 0) {
        relativePath = `${dirParts.join('/')}/${relativePath}`
      }
    }

    // For markdown files, use blob URL so they render on the provider's site
    // For other files, use raw URL for direct access
    const baseUrl = isMarkdownFile ? repoInfo.blobBaseUrl : repoInfo.rawBaseUrl
    return `${baseUrl}/${relativePath}`
  }

  // For markdown files without repo info, leave unchanged (like npm does)
  // This avoids 404s from jsdelivr which doesn't render markdown
  if (isMarkdownFile) {
    return url
  }

  // Fallback: relative URLs → jsdelivr CDN (may 404 if asset not in npm tarball)
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

// Convert blob/src URLs to raw URLs for images across all providers
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
//
// External images are proxied through /api/registry/image-proxy to prevent
// third-party servers from collecting visitor IP addresses and User-Agent data.
// Proxy URLs are HMAC-signed to prevent open proxy abuse.
// See: https://github.com/npmx-dev/npmx.dev/issues/1138
function resolveImageUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  // Skip already-proxied URLs (from a previous resolveImageUrl call in the
  // marked renderer — sanitizeHtml transformTags may call this again)
  if (url.startsWith('/api/registry/image-proxy')) {
    return url
  }
  const resolved = resolveUrl(url, packageName, repoInfo)
  const rawUrl = repoInfo?.provider
    ? convertBlobOrFileToRawUrl(resolved, repoInfo.provider)
    : resolved
  const { imageProxySecret } = useRuntimeConfig()
  return toProxiedImageUrl(rawUrl, imageProxySecret)
}

// Helper to prefix id attributes with 'user-content-'
function prefixId(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (attribs.id) {
    attribs.id = withUserContentPrefix(attribs.id)
  }
  return { tagName, attribs }
}

// README h1 always becomes h3
// For deeper levels, ensure sequential order
// Don't allow jumping more than 1 level deeper than previous
function calculateSemanticDepth(depth: number, lastSemanticLevel: number) {
  if (depth === 1) return 3
  const maxAllowed = Math.min(lastSemanticLevel + 1, 6)
  return Math.min(depth + 2, maxAllowed)
}

/**
 * Render YAML frontmatter as a GitHub-style key-value table.
 */
function renderFrontmatterTable(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
  if (entries.length === 0) return ''

  const rows = entries
    .map(([key, value]) => {
      const displayValue =
        typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
      return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(displayValue)}</td></tr>`
    })
    .join('\n')
  return `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>\n${rows}\n</tbody></table>\n`
}

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
): Promise<ReadmeResponse> {
  if (!content) return { html: '', playgroundLinks: [], toc: [] }

  // Parse and strip YAML frontmatter, render as table if present
  let markdownBody = content
  let frontmatterHtml = ''
  try {
    const { data, content: body } = matter(content)
    if (data && Object.keys(data).length > 0) {
      frontmatterHtml = renderFrontmatterTable(data)
      markdownBody = body
    }
  } catch {
    // If frontmatter parsing fails, render the full content as-is
  }

  const shiki = await getShikiHighlighter()
  const renderer = new marked.Renderer()

  // Collect playground links during parsing
  const collectedLinks: PlaygroundLink[] = []
  const seenUrls = new Set<string>()

  // Collect table of contents items during parsing
  const toc: TocItem[] = []

  // Track used heading slugs to handle duplicates (GitHub-style: foo, foo-1, foo-2)
  const usedSlugs = new Map<string, number>()

  // Track heading hierarchy to ensure sequential order for accessibility
  // Page h1 = package name, h2 = "Readme" section heading
  // So README starts at h3, and we ensure no levels are skipped
  // Visual styling preserved via data-level attribute (original depth)
  let lastSemanticLevel = 2 // Start after h2 (the "Readme" section heading)

  // Shared heading processing for both markdown and HTML headings
  function processHeading(
    depth: number,
    displayHtml: string,
    plainText: string,
    slugSource: string,
    preservedAttrs = '',
  ) {
    const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
    lastSemanticLevel = semanticLevel

    let slug = slugify(slugSource)
    if (!slug) slug = 'heading'

    const count = usedSlugs.get(slug) ?? 0
    usedSlugs.set(slug, count + 1)
    const uniqueSlug = count === 0 ? slug : `${slug}-${count}`
    const id = toUserContentId(uniqueSlug)

    if (plainText) {
      toc.push({ text: plainText, id, depth })
    }

    return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}><a href="#${id}">${displayHtml}</a></h${semanticLevel}>\n`
  }

  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const displayHtml = this.parser.parseInline(tokens)
    const plainText = getHeadingPlainText(displayHtml)
    const slugSource = getHeadingSlugSource(displayHtml)
    return processHeading(depth, displayHtml, plainText, slugSource)
  }

  // Extract and preserve allowed attributes from HTML heading tags
  function extractHeadingAttrs(attrsString: string): string {
    if (!attrsString) return ''
    const preserved: string[] = []
    const alignMatch = /\balign=(["']?)([^"'\s>]+)\1/i.exec(attrsString)
    if (alignMatch?.[2]) {
      preserved.push(`align="${alignMatch[2]}"`)
    }
    return preserved.length > 0 ? ` ${preserved.join(' ')}` : ''
  }

  // Intercept HTML headings so they get id, TOC entry, and correct semantic level.
  // Also intercept raw HTML <a> tags so playground links are collected in the same pass.
  const htmlHeadingRe = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi
  const htmlAnchorRe = /<a(\s[^>]*?)href=(["'])([^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi
  renderer.html = function ({ text }: Tokens.HTML) {
    let result = text.replace(htmlHeadingRe, (_, level, attrs = '', inner) => {
      const depth = parseInt(level)
      const plainText = getHeadingPlainText(inner)
      const slugSource = getHeadingSlugSource(inner)
      const preservedAttrs = extractHeadingAttrs(attrs)
      return processHeading(depth, inner, plainText, slugSource, preservedAttrs).trimEnd()
    })
    // Process raw HTML <a> tags for playground link collection and URL resolution
    result = result.replace(htmlAnchorRe, (_full, beforeHref, _quote, href, afterHref, inner) => {
      const label = decodeHtmlEntities(stripHtmlTags(inner).trim())
      const { resolvedHref, extraAttrs } = processLink(href, label)
      const preservedAttrs = normalizePreservedAnchorAttrs(`${beforeHref ?? ''}${afterHref ?? ''}`)
      return `<a${preservedAttrs} href="${resolvedHref}"${extraAttrs}>${inner}</a>`
    })
    return result
  }

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const html = highlightCodeSync(shiki, text, lang || 'text')
    // Add copy button
    return `<div class="readme-code-block" >
<button type="button" class="readme-copy-button" aria-label="Copy code" check-icon="i-lucide:check" copy-icon="i-lucide:copy" data-copy>
<span class="i-lucide:copy" aria-hidden="true"></span>
<span class="sr-only">Copy code</span>
</button>
${html}
</div>`
  }

  // Resolve image URLs (with GitHub blob → raw conversion)
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    const resolvedHref = resolveImageUrl(href, packageName, repoInfo)
    const titleAttr = title ? ` title="${title}"` : ''
    const altAttr = text ? ` alt="${text}"` : ''
    return `<img src="${resolvedHref}"${altAttr}${titleAttr}>`
  }

  // Helper: resolve a link href, collect playground links, and build <a> attributes.
  // Used by both the markdown renderer.link and the HTML <a> interceptor so that
  // all link processing happens in a single pass during marked rendering.
  function processLink(href: string, label: string): { resolvedHref: string; extraAttrs: string } {
    const resolvedHref = resolveUrl(href, packageName, repoInfo)

    // Collect playground links
    const provider = matchPlaygroundProvider(resolvedHref)
    if (provider && !seenUrls.has(resolvedHref)) {
      seenUrls.add(resolvedHref)
      collectedLinks.push({
        url: resolvedHref,
        provider: provider.id,
        providerName: provider.name,
        label: decodeHtmlEntities(label || provider.name),
      })
    }

    // Security attributes for external links
    let extraAttrs =
      resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
        ? ' rel="nofollow noreferrer noopener" target="_blank"'
        : ''

    return { resolvedHref, extraAttrs }
  }

  // Resolve link URLs, add security attributes, and collect playground links
  // — all in a single pass during marked rendering (no deferred processing)
  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''
    let plainText = stripHtmlTags(text).trim()

    // If plain text is empty, check if we have an image with alt text
    if (!plainText && tokens.length === 1 && tokens[0]?.type === 'image') {
      plainText = tokens[0].text
    }

    const { resolvedHref, extraAttrs } = processLink(href, plainText || title || '')

    return `<a href="${resolvedHref}"${titleAttr}${extraAttrs}>${text}</a>`
  }

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = function ({ tokens }: Tokens.Blockquote) {
    const body = this.parser.parse(tokens)

    const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i)

    if (calloutMatch?.[1]) {
      const calloutType = calloutMatch[1].toLowerCase()
      const cleanedBody = body.replace(calloutMatch[0], '<p>')
      return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`
    }

    return `<blockquote>${body}</blockquote>\n`
  }

  marked.setOptions({ renderer })

  // Strip trailing whitespace (tabs/spaces) from code block closing fences.
  // While marky-markdown handles these gracefully, marked fails to recognize
  // the end of a code block if the closing fences are followed by unexpected whitespaces.
  const normalizedContent = markdownBody.replace(/^( {0,3}(?:`{3,}|~{3,}))\s*$/gm, '$1')
  const rawHtml = frontmatterHtml + (marked.parse(normalizedContent) as string)

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // Transform img src URLs (GitHub blob → raw, relative → GitHub raw)
    transformTags: {
      // Headings are already processed to correct semantic levels by processHeading()
      // during the marked rendering pass. The sanitizer just needs to preserve them.
      // For any stray headings that didn't go through processHeading (shouldn't happen),
      // we still apply a safe fallback shift.
      h1: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h1', attribs }
        return { tagName: 'h3', attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h2', attribs }
        return { tagName: 'h4', attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs }
        return { tagName: 'h5', attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '6' } }
      },
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
        }
        return { tagName, attribs }
      },
      source: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
        }
        if (attribs.srcset) {
          attribs.srcset = attribs.srcset
            .split(',')
            .map(entry => {
              const parts = entry.trim().split(/\s+/)
              const url = parts[0]
              if (!url) return entry.trim()
              const descriptor = parts[1]
              const resolvedUrl = resolveImageUrl(url, packageName, repoInfo)
              return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
            })
            .join(', ')
        }
        return { tagName, attribs }
      },
      // Markdown links are fully processed in renderer.link (single-pass).
      // However, inline HTML <a> tags inside paragraphs are NOT seen by
      // renderer.html (marked parses them as paragraph tokens, not html tokens).
      // So we still need to collect playground links here for those cases.
      // The seenUrls set ensures no duplicates across both paths.
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        const resolvedHref = resolveUrl(attribs.href, packageName, repoInfo)

        // Collect playground links from inline HTML <a> tags that weren't
        // caught by renderer.link or renderer.html
        const provider = matchPlaygroundProvider(resolvedHref)
        if (provider && !seenUrls.has(resolvedHref)) {
          seenUrls.add(resolvedHref)
          collectedLinks.push({
            url: resolvedHref,
            provider: provider.id,
            providerName: provider.name,
            // sanitize-html transformTags doesn't provide element text content,
            // so we fall back to the provider name for the label
            label: provider.name,
          })
        }

        // Add security attributes for external links (idempotent)
        if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
          attribs.rel = 'nofollow noreferrer noopener'
          attribs.target = '_blank'
        }
        attribs.href = resolvedHref
        return { tagName, attribs }
      },
      div: prefixId,
      p: prefixId,
      span: prefixId,
      section: prefixId,
      article: prefixId,
    },
  })

  return {
    html: convertToEmoji(sanitized),
    mdExists: Boolean(content),
    playgroundLinks: collectedLinks,
    toc,
  }
}
