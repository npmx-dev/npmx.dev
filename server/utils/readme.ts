import { marked, type Tokens } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'
import type { ReadmeResponse } from '#shared/types/readme'
import { convertBlobToRawUrl, type RepositoryInfo } from '#shared/utils/git-providers'
import { highlightCodeSync } from './shiki'
import { convertToEmoji } from '#shared/utils/emoji'

/**
 * Playground provider configuration
 */
interface PlaygroundProvider {
  id: string // Provider identifier
  name: string
  domains: string[] // Associated domains
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
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return provider
        }
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

// only allow h3-h6 since we shift README headings down by 2 levels
// (page h1 = package name, h2 = "Readme" section, so README h1 → h3)
const ALLOWED_TAGS = [
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
]

const ALLOWED_ATTR: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  source: ['src', 'srcset', 'type', 'media'],
  th: ['colspan', 'rowspan', 'align'],
  td: ['colspan', 'rowspan', 'align'],
  h3: ['id', 'data-level'],
  h4: ['id', 'data-level'],
  h5: ['id', 'data-level'],
  h6: ['id', 'data-level'],
  blockquote: ['data-callout'],
  details: ['open'],
  code: ['class'],
  pre: ['class', 'style'],
  span: ['class', 'style'],
  div: ['class', 'style', 'align'],
}

// GitHub-style callout types
// Format: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]

/**
 * Generate a GitHub-style slug from heading text.
 * - Convert to lowercase
 * - Remove HTML tags
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric, hyphens, underscores)
 * - Collapse multiple hyphens
 */
function slugify(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '') // Keep alphanumeric, CJK, hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}

/**
 * Resolve a relative URL to an absolute URL.
 * If repository info is available, resolve to provider's raw file URLs.
 * Otherwise, fall back to jsdelivr CDN.
 */
function resolveUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  if (!url) return url
  if (url.startsWith('#')) {
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    return `#user-content-${url.slice(1)}`
  }
  if (hasProtocol(url, { acceptRelative: true })) {
    try {
      const parsed = new URL(url, 'https://example.com')
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
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

  // Use provider's raw URL base when repository info is available
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

    return `${repoInfo.rawBaseUrl}/${relativePath}`
  }

  // Fallback: relative URLs → jsdelivr CDN (may 404 if asset not in npm tarball)
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

// Convert blob/src URLs to raw URLs for images across all providers
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
function resolveImageUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  const resolved = resolveUrl(url, packageName, repoInfo)
  if (repoInfo?.provider) {
    return convertBlobToRawUrl(resolved, repoInfo.provider)
  }
  return resolved
}

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
): Promise<ReadmeResponse> {
  if (!content) return { html: '', playgroundLinks: [] }

  const shiki = await getShikiHighlighter()
  const renderer = new marked.Renderer()

  // Collect playground links during parsing
  const collectedLinks: PlaygroundLink[] = []
  const seenUrls = new Set<string>()

  // Track used heading slugs to handle duplicates (GitHub-style: foo, foo-1, foo-2)
  const usedSlugs = new Map<string, number>()

  // Track heading hierarchy to ensure sequential order for accessibility
  // Page h1 = package name, h2 = "Readme" section heading
  // So README starts at h3, and we ensure no levels are skipped
  // Visual styling preserved via data-level attribute (original depth)
  let lastSemanticLevel = 2 // Start after h2 (the "Readme" section heading)
  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    // Calculate the target semantic level based on document structure
    // Start at h3 (since page h1 + section h2 already exist)
    // But ensure we never skip levels - can only go down by 1 or stay same/go up
    let semanticLevel: number
    if (depth === 1) {
      // README h1 always becomes h3
      semanticLevel = 3
    } else {
      // For deeper levels, ensure sequential order
      // Don't allow jumping more than 1 level deeper than previous
      const maxAllowed = Math.min(lastSemanticLevel + 1, 6)
      semanticLevel = Math.min(depth + 2, maxAllowed)
    }

    lastSemanticLevel = semanticLevel
    const text = this.parser.parseInline(tokens)

    // Generate GitHub-style slug for anchor links
    let slug = slugify(text)
    if (!slug) slug = 'heading' // Fallback for empty headings

    // Handle duplicate slugs (GitHub-style: foo, foo-1, foo-2)
    const count = usedSlugs.get(slug) ?? 0
    usedSlugs.set(slug, count + 1)
    const uniqueSlug = count === 0 ? slug : `${slug}-${count}`

    // Prefix with 'user-content-' to avoid collisions with page IDs
    // (e.g., #install, #dependencies, #versions are used by the package page)
    const id = `user-content-${uniqueSlug}`

    return `<h${semanticLevel} id="${id}" data-level="${depth}">${text}</h${semanticLevel}>\n`
  }

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = ({ text, lang }: Tokens.Code) => {
    return highlightCodeSync(shiki, text, lang || 'text')
  }

  // Resolve image URLs (with GitHub blob → raw conversion)
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    const resolvedHref = resolveImageUrl(href, packageName, repoInfo)
    const titleAttr = title ? ` title="${title}"` : ''
    const altAttr = text ? ` alt="${text}"` : ''
    return `<img src="${resolvedHref}"${altAttr}${titleAttr}>`
  }

  // Resolve link URLs, add security attributes, and collect playground links
  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const resolvedHref = resolveUrl(href, packageName, repoInfo)
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''

    const isExternal = resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://')
    const relAttr = isExternal ? ' rel="nofollow noreferrer noopener"' : ''
    const targetAttr = isExternal ? ' target="_blank"' : ''

    // Check if this is a playground link
    const provider = matchPlaygroundProvider(resolvedHref)
    if (provider && !seenUrls.has(resolvedHref)) {
      seenUrls.add(resolvedHref)

      // Extract label from link text (strip HTML tags for plain text)
      const plainText = text.replace(/<[^>]*>/g, '').trim()

      collectedLinks.push({
        url: resolvedHref,
        provider: provider.id,
        providerName: provider.name,
        label: plainText || title || provider.name,
      })
    }

    return `<a href="${resolvedHref}"${titleAttr}${relAttr}${targetAttr}>${text}</a>`
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

  const rawHtml = marked.parse(content) as string

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // Transform img src URLs (GitHub blob → raw, relative → GitHub raw)
    transformTags: {
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
      a: (tagName, attribs) => {
        // Add security attributes for external links
        if (attribs.href && hasProtocol(attribs.href, { acceptRelative: true })) {
          attribs.rel = 'nofollow noreferrer noopener'
          attribs.target = '_blank'
        }
        return { tagName, attribs }
      },
    },
  })

  return {
    html: convertToEmoji(sanitized),
    playgroundLinks: collectedLinks,
  }
}
