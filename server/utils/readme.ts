import { marked, type Tokens } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { createHighlighter, type Highlighter } from 'shiki'

// only allow h3-h6 since we shift README headings down by 2 levels
// (page h1 = package name, h2 = "Readme" section, so README h1 → h3)
const ALLOWED_TAGS = [
  'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'strong', 'em', 'del', 's',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'picture', 'source',
  'details', 'summary',
  'div', 'span',
  'sup', 'sub',
  'kbd', 'mark',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title',
  'class', 'id',
  'target', 'rel',
  'width', 'height',
  'colspan', 'rowspan',
  'align',
  'open',
  'data-level', // For visual heading styling
  'data-callout', // For GitHub-style callouts
  'style', // For Shiki inline styles
]

// GitHub-style callout types
// Format: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]

// Singleton highlighter instance
let highlighter: Highlighter | null = null

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-dark'],
      langs: [
        'javascript',
        'typescript',
        'json',
        'html',
        'css',
        'bash',
        'shell',
        'markdown',
        'yaml',
        'vue',
        'jsx',
        'tsx',
        'diff',
        'sql',
        'graphql',
        'python',
        'rust',
        'go',
      ],
    })
  }
  return highlighter
}

function resolveUrl(url: string, packageName: string): string {
  if (!url) return url
  if (url.startsWith('#')) {
    return url
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return url
  }
  // Relative URLs → jsdelivr CDN
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

// Convert GitHub blob URLs to raw URLs for images
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
function resolveImageUrl(url: string, packageName: string): string {
  const resolved = resolveUrl(url, packageName)
  // GitHub blob → raw
  if (resolved.includes('github.com') && resolved.includes('/blob/')) {
    return resolved.replace('/blob/', '/raw/')
  }
  return resolved
}

export async function renderReadmeHtml(content: string, packageName: string): Promise<string> {
  if (!content) return ''

  const shiki = await getHighlighter()
  const renderer = new marked.Renderer()

  // Shift heading levels down by 2 for semantic correctness
  // Page h1 = package name, h2 = "Readme" section heading
  // So README h1 → h3, h2 → h4, etc. (capped at h6)
  // But keep visual styling via data-level attribute
  renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
    const semanticLevel = Math.min(depth + 2, 6)
    const text = this.parser.parseInline(tokens)
    return `<h${semanticLevel} data-level="${depth}">${text}</h${semanticLevel}>\n`
  }

  // Syntax highlighting for code blocks
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
      }
      catch {
        // Fall back to plain code block
      }
    }

    // Plain code block for unknown languages
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return `<pre><code class="language-${language}">${escaped}</code></pre>\n`
  }

  // Resolve image URLs (with GitHub blob → raw conversion)
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    const resolvedHref = resolveImageUrl(href, packageName)
    const titleAttr = title ? ` title="${title}"` : ''
    const altAttr = text ? ` alt="${text}"` : ''
    return `<img src="${resolvedHref}"${altAttr}${titleAttr}>`
  }

  // Resolve link URLs and add security attributes
  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const resolvedHref = resolveUrl(href, packageName)
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''

    const isExternal = resolvedHref.startsWith('http://') || resolvedHref.startsWith('https://')
    const relAttr = isExternal ? ' rel="nofollow noreferrer noopener"' : ''
    const targetAttr = isExternal ? ' target="_blank"' : ''

    return `<a href="${resolvedHref}"${titleAttr}${relAttr}${targetAttr}>${text}</a>`
  }

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = function ({ tokens }: Tokens.Blockquote) {
    const body = this.parser.parse(tokens)

    const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i)

    if (calloutMatch) {
      const calloutType = calloutMatch[1].toLowerCase()
      const cleanedBody = body.replace(calloutMatch[0], '<p>')
      return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`
    }

    return `<blockquote>${body}</blockquote>\n`
  }

  marked.setOptions({ renderer })

  const rawHtml = marked.parse(content) as string

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IMG' && node.hasAttribute('src')) {
      const src = node.getAttribute('src') || ''
      const resolved = resolveImageUrl(src, packageName)
      if (resolved !== src) {
        node.setAttribute('src', resolved)
      }
    }
  })

  const sanitized = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  })

  DOMPurify.removeHook('afterSanitizeAttributes')

  return sanitized
}
