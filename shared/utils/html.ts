/**
 * Escape HTML special characters to prevent XSS and ensure safe embedding.
 * Handles text content and attribute values (`&`, `<`, `>`, `"`, `'`).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
