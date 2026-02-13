import { marked, type Tokens } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'
import type { ReadmeResponse, TocItem } from '#shared/types/readme'
import { convertBlobOrFileToRawUrl, type RepositoryInfo } from '#shared/utils/git-providers'
import { highlightCodeSync } from './shiki'
import { convertToEmoji } from '#shared/utils/emoji'

/**
 * Playground provider configuration
 */
interface PlaygroundProvider {
  id: string // Provider identifier
  name: string
  domains: string[] // Associated domains
  path?: string
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
    path: '/play',
    icon: 'typescript',
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
          (!provider.path || parsed.pathname.startsWith(provider.path))
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

const isNpmJsUrlThatCanBeRedirected = (url: URL) => {
  if (url.host !== 'www.npmjs.com' && url.host !== 'npmjs.com') {
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
    return `#user-content-${url.slice(1)}`
  }
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
function resolveImageUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  const resolved = resolveUrl(url, packageName, repoInfo)
  if (repoInfo?.provider) {
    return convertBlobOrFileToRawUrl(resolved, repoInfo.provider)
  }
  return resolved
}

// Helper to prefix id attributes with 'user-content-'
function prefixId(tagName: string, attribs: sanitizeHtml.Attributes) {
  if (attribs.id && !attribs.id.startsWith('user-content-')) {
    attribs.id = `user-content-${attribs.id}`
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

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
): Promise<ReadmeResponse> {
  if (!content) return { html: '', playgroundLinks: [], toc: [] }

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
  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    // Calculate the target semantic level based on document structure
    // Start at h3 (since page h1 + section h2 already exist)
    // But ensure we never skip levels - can only go down by 1 or stay same/go up
    const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
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

    // Collect TOC item with plain text (HTML stripped)
    const plainText = text.replace(/<[^>]*>/g, '').trim()
    if (plainText) {
      toc.push({ text: plainText, id, depth })
    }

    /** The link href uses the unique slug WITHOUT the 'user-content-' prefix, because that will later be added for all links. */
    return `<h${semanticLevel} id="${id}" data-level="${depth}"><a href="#${uniqueSlug}">${plainText}</a></h${semanticLevel}>\n`
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

  // // Resolve link URLs, add security attributes, and collect playground links
  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''
    let plainText = text.replace(/<[^>]*>/g, '').trim()

    // If plain text is empty, check if we have an image with alt text
    if (!plainText && tokens.length === 1 && tokens[0]?.type === 'image') {
      plainText = tokens[0].text
    }

    const intermediateTitleAttr =
      plainText || title ? ` data-title-intermediate="${plainText || title}"` : ''

    return `<a href="${href}"${titleAttr}${intermediateTitleAttr}>${text}</a>`
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
      h1: (_, attribs) => {
        return { tagName: 'h3', attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        return { tagName: 'h4', attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs: attribs }
        return { tagName: 'h5', attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs: attribs }
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
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        const resolvedHref = resolveUrl(attribs.href, packageName, repoInfo)

        const provider = matchPlaygroundProvider(resolvedHref)
        if (provider && !seenUrls.has(resolvedHref)) {
          seenUrls.add(resolvedHref)

          collectedLinks.push({
            url: resolvedHref,
            provider: provider.id,
            providerName: provider.name,
            /**
             * We need to set some data attribute before hand because `transformTags` doesn't
             * provide the text of the element. This will automatically be removed, because there
             * is an allow list for link attributes.
             * */
            label: attribs['data-title-intermediate'] || provider.name,
          })
        }

        // Add security attributes for external links
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
