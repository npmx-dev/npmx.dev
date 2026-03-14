import type { KnownUrl } from 'module-replacements'

export function resolveReplacementUrl(url?: KnownUrl): string | null {
  if (!url) return null
  if (typeof url === 'string') return url

  switch (url.type) {
    case 'mdn':
      return `https://developer.mozilla.org/en-US/docs/${url.id}`
    case 'node':
      return `https://nodejs.org/${url.id}`
    case 'e18e':
      return `https://e18e.dev/docs/replacements/${url.id}`
    default:
      return null
  }
}
