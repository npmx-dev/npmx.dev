import { decodeHtmlEntities } from '#shared/utils/html'

interface UseMarkdownOptions {
  text: string
  /** When true, renders link text without the anchor tag (useful when inside another link) */
  plain?: boolean
}

export function useMarkdown(options: MaybeRefOrGetter<UseMarkdownOptions>) {
  return computed(() => parseMarkdown(toValue(options)))
}

/**
 * Each step strips one badge shape. Bounded quantifiers ({0,N}) guard against
 * ReDoS, and patterns are compiled once at module scope so reactive callers
 * don't pay re-instantiation cost on every render.
 */
const STRIPPABLE_MARKDOWN = Object.freeze([
  // Image atom: ![alt](url) OR reference-style ![alt][ref]
  /!\[[^\]]{0,500}\](?:\([^)]{0,2000}\)|\[[^\]]{0,500}\])/g,
  // Empty link wrapper left behind after image removal: [](url) OR [][ref]
  /\[\s*\](?:\([^)]{0,2000}\)?|\[[^\]]{0,500}\])/g,
  // Reference link definition line: [ref]: url "optional title"
  /^[ \t]*\[[^\]]{1,500}\]:[ \t]+\S{1,2000}(?:[ \t]+["'(].*?["')])?[ \t]*$/gm,
])

/**
 * Strip markdown image badges from text.
 * Each pass removes image atoms, empty link wrappers, and reference defs.
 * Re-run to a fixed point so nested shapes like `[![…][ref]][ref]` collapse
 * without per-shape rules.
 */
function stripMarkdownImages(text: string): string {
  let previous: string
  do {
    previous = text
    for (const pattern of STRIPPABLE_MARKDOWN) {
      text = text.replace(pattern, '')
    }
  } while (text !== previous)
  return text.trim()
}

// Strip HTML tags and escape remaining HTML to prevent XSS
function stripAndEscapeHtml(text: string): string {
  // First decode any HTML entities in the input
  let stripped = decodeHtmlEntities(text)

  // Then strip markdown image badges
  stripped = stripMarkdownImages(stripped)

  // Strip actual HTML tags (keep their text content), but leave tags inside backtick spans
  // The alternation matches a backtick span first — if that branch wins the match is kept as-is
  stripped = stripped.replace(
    /(`[^`]*`)|<\/?[a-z][^>]*>/gi,
    (match, codeSpan: string | undefined) => codeSpan ?? '',
  )

  // Strip HTML comments: <!-- ... --> (including unclosed comments from truncation)
  stripped = stripped.replace(
    /(`[^`]*`)|<!--[\s\S]*?(-->|$)/g,
    (match, codeSpan: string | undefined) => codeSpan ?? '',
  )

  // Then escape any remaining HTML entities
  return stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Parse simple inline markdown to HTML
function parseMarkdown({ text, plain }: UseMarkdownOptions): string {
  if (!text) return ''

  // First strip HTML tags and escape remaining HTML
  let html = stripAndEscapeHtml(text)

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/\b_(.+?)_\b/g, '<em>$1</em>')

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links: [text](url) - only allow https, mailto
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, textGroup, url) => {
    // In plain mode, just render the link text without the anchor
    if (plain) {
      return textGroup
    }
    const decodedUrl = url.replace(/&amp;/g, '&')
    try {
      const { protocol, href } = new URL(decodedUrl)
      if (['https:', 'mailto:'].includes(protocol)) {
        const safeUrl = href.replace(/"/g, '&quot;')
        return `<a href="${safeUrl}" rel="nofollow noreferrer noopener" target="_blank">${textGroup}</a>`
      }
    } catch {}
    return `${textGroup} (${url})`
  })

  return html
}
