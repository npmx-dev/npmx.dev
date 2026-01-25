import { marked, type Tokens } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol, withoutTrailingSlash } from 'ufo'
import type { ReadmeResponse } from '#shared/types/readme.js'

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

export interface RepositoryInfo {
  /** GitHub raw base URL (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl?: string
  /** Subdirectory within repo where package lives (e.g., packages/ai) */
  directory?: string
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
  div: ['class', 'style'],
}

// GitHub-style callout types
// Format: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]

/**
 * Parse repository field from package.json into GitHub raw URL base.
 * Supports both full objects and shorthand strings.
 */
export function parseRepositoryInfo(
  repository?: { type?: string; url?: string; directory?: string } | string,
): RepositoryInfo | undefined {
  if (!repository) return undefined

  let url: string | undefined
  let directory: string | undefined

  if (typeof repository === 'string') {
    url = repository
  } else {
    url = repository.url
    directory = repository.directory
  }

  if (!url) return undefined

  // Parse GitHub URL: git+https://github.com/owner/repo.git or https://github.com/owner/repo
  const githubMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/)
  if (!githubMatch?.[1] || !githubMatch[2]) return undefined

  const owner = githubMatch[1]
  const repo = githubMatch[2]

  return {
    rawBaseUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`,
    directory: directory ? withoutTrailingSlash(directory) : undefined,
  }
}

/**
 * Resolve a relative URL to an absolute URL.
 * If repository info is available, resolve to GitHub raw URLs.
 * Otherwise, fall back to jsdelivr CDN.
 */
function resolveUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  if (!url) return url
  if (url.startsWith('#')) {
    return url
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return url
  }

  // Prefer GitHub raw URLs when repository info is available
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

// Convert GitHub blob URLs to raw URLs for images
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
function resolveImageUrl(url: string, packageName: string, repoInfo?: RepositoryInfo): string {
  const resolved = resolveUrl(url, packageName, repoInfo)
  // GitHub blob → raw
  if (resolved.includes('github.com') && resolved.includes('/blob/')) {
    return resolved.replace('/blob/', '/raw/')
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

  // Shift heading levels down by 2 for semantic correctness
  // Page h1 = package name, h2 = "Readme" section heading
  // So README h1 → h3, h2 → h4, etc. (capped at h6)
  // But keep visual styling via data-level attribute
  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const semanticLevel = Math.min(depth + 2, 6)
    const text = this.parser.parseInline(tokens)
    return `<h${semanticLevel} data-level="${depth}">${text}</h${semanticLevel}>\n`
  }

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const language = lang || 'text'
    const loadedLangs = shiki.getLoadedLanguages()

    // Use Shiki if language is loaded, otherwise fall back to plain
    if (loadedLangs.includes(language as never)) {
      try {
        return shiki.codeToHtml(text, {
          lang: language,
          theme: 'github-dark',
        })
      } catch {
        // Fall back to plain code block
      }
    }

    // Plain code block for unknown languages
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre><code class="language-${language}">${escaped}</code></pre>\n`
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
    html: sanitized,
    playgroundLinks: collectedLinks,
  }
}
