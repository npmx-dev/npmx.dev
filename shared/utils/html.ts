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
/**
 * Generate a GitHub-style slug from heading text.
 * - Convert to lowercase
 * - Remove HTML tags
 * - Replace spaces with hyphens
 * - Remove special characters (keep alphanumeric, hyphens, underscores)
 * - Collapse multiple hyphens
 */
export function slugify(text: string): string {
  return stripHtmlTags(text)
    .replace(/&nbsp;?/g, '') // remove non breaking spaces
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff-]/g, '') // Keep alphanumeric, CJK, hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Trim leading/trailing hyphens
}
