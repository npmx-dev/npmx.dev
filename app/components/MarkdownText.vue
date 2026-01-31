<script setup lang="ts">
const props = defineProps<{
  text: string
  /** When true, renders link text without the anchor tag (useful when inside another link) */
  plain?: boolean
  /** Package name to strip from the beginning of the description (if present) */
  packageName?: string
}>()

// Strip markdown image badges from text
function stripMarkdownImages(text: string): string {
  // Remove linked images: [![alt](image-url)](link-url) - handles incomplete URLs too
  // Using {0,500} instead of * to prevent ReDoS on pathological inputs
  text = text.replace(/\[!\[[^\]]{0,500}\]\([^)]{0,2000}\)\]\([^)]{0,2000}\)?/g, '')
  // Remove standalone images: ![alt](url)
  text = text.replace(/!\[[^\]]{0,500}\]\([^)]{0,2000}\)/g, '')
  // Remove any leftover empty links or broken markdown link syntax
  text = text.replace(/\[\]\([^)]{0,2000}\)?/g, '')
  return text.trim()
}

// Strip HTML tags and escape remaining HTML to prevent XSS
function stripAndEscapeHtml(text: string): string {
  // First strip markdown image badges
  let stripped = stripMarkdownImages(text)

  // Then strip actual HTML tags (keep their text content)
  // Only match tags that start with a letter or / (to avoid matching things like "a < b > c")
  stripped = stripped.replace(/<\/?[a-z][^>]*>/gi, '')

  if (props.packageName) {
    // Trim first to handle leading/trailing whitespace from stripped HTML
    stripped = stripped.trim()
    // Collapse multiple whitespace into single space
    stripped = stripped.replace(/\s+/g, ' ')
    // Escape special regex characters in package name
    const escapedName = props.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match package name at the start, optionally followed by: space, dash, colon, hyphen, or just space
    const namePattern = new RegExp(`^${escapedName}\\s*[-:—]?\\s*`, 'i')
    stripped = stripped.replace(namePattern, '').trim()
  }

  // Then escape any remaining HTML entities
  return stripped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Parse simple inline markdown to HTML
function parseMarkdown(text: string): string {
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
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    // In plain mode, just render the link text without the anchor
    if (props.plain) {
      return text
    }
    const decodedUrl = url.replace(/&amp;/g, '&')
    try {
      const { protocol, href } = new URL(decodedUrl)
      if (['https:', 'mailto:'].includes(protocol)) {
        const safeUrl = href.replace(/"/g, '&quot;')
        return `<a href="${safeUrl}" rel="nofollow noreferrer noopener" target="_blank">${text}</a>`
      }
    } catch {}
    return `${text} (${url})`
  })

  return html
}

const html = computed(() => parseMarkdown(props.text))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-html="html" />
</template>
