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
  // Strip unclosed HTML tags left by registry truncation (no closing '>').
  // Only a bare tag name at the very end that starts a word, or one followed by an attribute ('=' or a quote),
  // counts, so plain text like `x<y comparisons` or a trailing `a<b` is kept.
  // The match must not cross a backtick, or it would swallow a later code span
  return result
    .replace(/(?<!\S)<\/?[a-z][a-z0-9-]*$|<\/?[a-z][a-z0-9-]*\s[^>`="']*[="'][^>`]*$/gi, '')
    .trim()
}
/**
 * Generate a GitHub-style slug from heading text.
 * - Convert to lowercase
 * - Remove HTML tags
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric, hyphens, underscores)
 * - Collapse multiple hyphens
 */
export function slugify(text: string): string {
  return decodeHtmlEntities(stripHtmlTags(text))
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '') // Keep alphanumeric, CJK, hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}
