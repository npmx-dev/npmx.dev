const htmlEntities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': '\u00A0',
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, match => htmlEntities[match] || match)
}

/**
 * Strip all HTML tags from a string, looping until stable to prevent
 * incomplete sanitization from nested/interleaved tags
 * (e.g. `<scr<script>ipt>` → `<script>` after one pass).
 */
export function stripHtmlTags(text: string): string {
  const tagPattern = /<[^>]*>/g
  let result = text
  let previous: string
  do {
    previous = result
    result = result.replace(tagPattern, '')
  } while (result !== previous)
  return result
}
