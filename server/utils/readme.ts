import { marked, type Tokens } from 'marked'
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
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
]

function resolveRelativeUrl(url: string, packageName: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return url
  }
  if (url.startsWith('#')) {
    return url
  }
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

export function renderReadmeHtml(content: string, packageName: string): string {
  if (!content) return ''

  const renderer = new marked.Renderer()

  const originalImage = renderer.image.bind(renderer)
  renderer.image = (token: Tokens.Image) => {
    const resolvedHref = resolveRelativeUrl(token.href, packageName)
    return originalImage({ ...token, href: resolvedHref })
  }

  const originalLink = renderer.link.bind(renderer)
  renderer.link = (token: Tokens.Link) => {
    const resolvedHref = resolveRelativeUrl(token.href, packageName)
    return originalLink({ ...token, href: resolvedHref })
  }

  marked.setOptions({ renderer })

  const rawHtml = marked.parse(content) as string

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  })
}
