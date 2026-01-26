<script setup lang="ts">
const props = defineProps<{
  text: string
}>()

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Parse simple inline markdown to HTML
function parseMarkdown(text: string): string {
  if (!text) return ''

  // First escape HTML
  let html = escapeHtml(text)

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
    const decodedUrl = url.replace(/&amp;/g, '&')
    try {
      const parsed = new URL(decodedUrl)
      if (['https:', 'mailto:'].includes(parsed.protocol)) {
        const safeUrl = parsed.toString().replace(/"/g, '&quot;')
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
