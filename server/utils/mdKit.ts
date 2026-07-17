import {
  type Tokens,
  type RendererApi,
  type Renderer,
  type TokenizerObject,
  type Marked,
  marked,
} from 'marked'
import { highlightCodeSync } from './shiki'
import { decodeHtmlEntities, stripHtmlTags, slugify } from '#shared/utils/html'
import { escapeHtml } from './docs/text'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'

/// for marked

// constands
const npmJsHosts = new Set(['www.npmjs.com', 'npmjs.com', 'www.npmjs.org', 'npmjs.org'])

/** These path on npmjs.com don't belong to packages or search, so we shouldn't try to replace them with npmx.dev urls */
const reservedPathsNpmJs = [
  'products',
  'login',
  'signup',
  'advisories',
  'blog',
  'about',
  'press',
  'policies',
]

// blockquote & code

/**
 * GitHub-style callouts: > [!NOTE], > [!TIP], etc.
 */
export const blockquote: RendererApi['blockquote'] = function (
  this: Renderer<string, string>,
  { tokens },
) {
  const body = this.parser.parse(tokens)

  const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i)

  if (calloutMatch?.[1]) {
    const calloutType = calloutMatch[1].toLowerCase()
    const cleanedBody = body.replace(calloutMatch[0], '<p>')
    return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`
  }

  return `<blockquote>${body}</blockquote>\n`
}

/**
 * created code highlighter with Shiki for Marked
 */
export async function createCodeHighlighter(): Promise<RendererApi['code']> {
  const shiki = await getShikiHighlighter()

  // Syntax highlighting for code blocks (uses shared highlighter)
  return ({ text, lang }: Tokens.Code) => {
    const html = highlightCodeSync(shiki, text, lang || 'text')
    // Add copy button
    return `<div class="readme-code-block" >
  <button type="button" class="readme-copy-button" aria-label="Copy code" check-icon="i-lucide:check" copy-icon="i-lucide:copy" data-copy>
  <span class="i-lucide:copy" aria-hidden="true"></span>
  <span class="sr-only">Copy code</span>
  </button>
  ${html}
  </div>`
  }
}

// link
export type ProcessLinkFn = (
  href: string,
  label: string,
  // readme.ts also needs the extraAttrs for more things, so can't be a boolean
) => { resolvedHref: string; extraAttrs: string }

export function decodeHashFragment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const EMAIL_REGEX = /^[\w+\-.]+@[\w\-.]+\.[a-z]+$/i

/**
 * Resolve link URLs, add security attributes, and collect playground links
 *
 * — all in a single pass during marked rendering (no deferred processing)
 */
export function createLink(processLink: ProcessLinkFn): RendererApi['link'] {
  return function (this: Renderer<string, string>, { href, title, tokens }: Tokens.Link) {
    const eTitle = escapeHtml(title ?? '')
    const text = this.parser.parseInline(tokens)
    const titleAttr = eTitle ? ` title="${eTitle}"` : ''
    let plainText = stripHtmlTags(text).trim()

    // If plain text is empty, check if we have an image with alt text
    if (!plainText && tokens.length === 1 && tokens[0]?.type === 'image') {
      plainText = tokens[0].text
    }

    const { resolvedHref, extraAttrs } = processLink(href, plainText || eTitle || '')

    if (!resolvedHref) return text

    // prevents package@1.0.0 being made into an email
    if (href.startsWith('mailto:') && !EMAIL_REGEX.test(plainText)) {
      return text
    }

    return `<a href="${resolvedHref}"${titleAttr}${extraAttrs}>${text}</a>`
  }
}

export const isNpmJsUrlThatCanBeRedirected = (url: URL) => {
  if (!npmJsHosts.has(url.host)) {
    return false
  }

  if (
    url.pathname === '/' ||
    reservedPathsNpmJs.some(path => url.pathname.startsWith(`/${path}`))
  ) {
    return false
  }

  return true
}

// image

export type ProcessImageUrlFn = (href: string) => string

export const createImage = function (processImageUrl: ProcessImageUrlFn): RendererApi['image'] {
  return function (this: Renderer<string, string>, { href, title, text }) {
    const resolvedHref = processImageUrl(href)
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : ''
    const altAttr = text ? ` alt="${escapeHtml(text)}"` : ''
    return `<img src="${resolvedHref}"${altAttr}${titleAttr}>`
  }
}

// heading

/**
 * Lazy ATX heading extension for marked: allows headings without a space after `#`.
 *
 * Reimplements the behavior of markdown-it-lazy-headers
 * (https://npmx.dev/package/markdown-it-lazy-headers), which is used by npm's own markdown renderer
 * marky-markdown (https://npmx.dev/package/marky-markdown).
 *
 * CommonMark requires a space after # for ATX headings, but many READMEs in the npm registry omit
 * this space. This extension allows marked to parse these headings the same way npm does.
 *
 * @param exemptIssuePr do not turn #{number} into a heading, treat it as an issue/pr instead
 */
export function createMarkedHeadingExtension(exemptIssuePr?: boolean): TokenizerObject['heading'] {
  return function (src: string) {
    // Only match headings where `#` is immediately followed by non-whitespace, non-`#` content.
    // Normal headings (with space) return false to fall through to marked's default tokenizer.
    const match = /^ {0,3}(#{1,6})([^\s#][^\n]*)(?:\n+|$)/.exec(src)
    if (!match) return false
    if (exemptIssuePr && /^#\d+\b/.test(match[0])) return false

    console.log({ match, test: /^#\d+\b/.test(match[0]), exemptIssuePr })

    let text = match[2]!.trim()

    // Strip trailing # characters only if preceded by a space (CommonMark behavior).
    // e.g., "#heading ##" → "heading", but "#heading#" stays as "heading#"
    if (text.endsWith('#')) {
      const stripped = text.replace(/#+$/, '')
      if (!stripped || stripped.endsWith(' ')) {
        text = stripped.trim()
      }
    }

    return {
      type: 'heading' as const,
      raw: match[0]!,
      depth: match[1]!.length as number,
      text,
      tokens: this.lexer.inline(text),
    }
  }
}

export const USER_CONTENT_PREFIX = 'user-content-'

// README h1 always becomes h3
// For deeper levels, ensure sequential order
// Don't allow jumping more than 1 level deeper than previous
export function calculateSemanticDepth(
  depth: number,
  lastSemanticLevel: number,
  minSemanticLevel: number,
) {
  if (depth === 1) return minSemanticLevel + 1
  const maxAllowed = Math.min(lastSemanticLevel + 1, 6)
  return Math.min(depth + minSemanticLevel, maxAllowed)
}

export function getHeadingPlainText(text: string): string {
  return decodeHtmlEntities(stripHtmlTags(text).trim())
}

export function getHeadingSlugSource(text: string): string {
  return stripHtmlTags(text).trim()
}

const htmlAnchorRe = /<a(\s[^>]*?)href=(["'])([^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi

export type ToUserContentIdFn = (id: string) => string

type ProcessHeadingFn = (
  depth: number,
  displayHtml: string,
  plainText: string,
  slugSource: string,
  preservedAttrs?: string,
) => string

export function createHeading(options: {
  lastSemanticLevel?: number
  toUserContentId: ToUserContentIdFn
}) {
  let { lastSemanticLevel = 2, toUserContentId } = options
  const minSemanticLevel = lastSemanticLevel
  const toc: TocItem[] = []
  const usedSlugs = new Map<string, number>()

  const heading: RendererApi['heading'] = function (
    this: Renderer<string, string>,
    { tokens, depth },
  ) {
    const displayHtml = this.parser.parseInline(tokens)
    const plainText = getHeadingPlainText(displayHtml)
    const slugSource = getHeadingSlugSource(displayHtml)
    return processHeading(depth, displayHtml, plainText, slugSource)
  }

  const processHeading: ProcessHeadingFn = function (
    depth: number,
    displayHtml: string,
    plainText: string,
    slugSource: string,
    preservedAttrs = '',
  ) {
    const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel, minSemanticLevel)
    lastSemanticLevel = semanticLevel

    let slug = slugify(slugSource)
    if (!slug) slug = 'heading'

    const count = usedSlugs.get(slug) ?? 0
    usedSlugs.set(slug, count + 1)
    const uniqueSlug = count === 0 ? slug : `${slug}-${count}`
    const id = toUserContentId(uniqueSlug)

    if (plainText) {
      toc.push({ text: plainText, id, depth })
    }

    // The browser doesn't support anchors within anchors and automatically extracts them from each other,
    // causing a hydration error. To prevent this from happening in such cases, we use the anchor separately
    if (displayHtml.match(htmlAnchorRe)?.length) {
      return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}>${displayHtml}<a href="#${id}" aria-hidden="true" tabindex="-1"></a></h${semanticLevel}>\n`
    }

    return `<h${semanticLevel} id="${id}" data-level="${depth}"${preservedAttrs}><a href="#${id}">${displayHtml}</a></h${semanticLevel}>\n`
  }

  return { heading, toc, processHeading }
}

// html

// Extract and preserve allowed attributes from HTML heading tags
export function extractHeadingAttrs(attrsString: string): string {
  if (!attrsString) return ''
  const preserved: string[] = []
  const alignMatch = /\balign=(["']?)([^"'\s>]+)\1/i.exec(attrsString)
  if (alignMatch?.[2]) {
    preserved.push(`align="${alignMatch[2]}"`)
  }
  return preserved.length > 0 ? ` ${preserved.join(' ')}` : ''
}

// Intercept HTML headings so they get id, TOC entry, and correct semantic level.
// Also intercept raw HTML <a> tags so playground links are collected in the same pass.
const htmlHeadingRe = /<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi

function normalizePreservedAnchorAttrs(attrs: string): string {
  const cleanedAttrs = attrs
    .replace(/\s+href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+rel\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+target\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .trim()

  return cleanedAttrs ? ` ${cleanedAttrs}` : ''
}

export function createHtml({
  processHeading,
  processLink,
}: {
  processHeading: ProcessHeadingFn
  processLink: ProcessLinkFn
}) {
  // function withUserContentPrefix(value: string): string {
  // return value.startsWith(USER_CONTENT_PREFIX) ? value : `${USER_CONTENT_PREFIX}${value}`
  // }

  return function ({ text }: Tokens.HTML) {
    let result = text.replace(htmlHeadingRe, (_, level, attrs = '', inner) => {
      const depth = parseInt(level)
      const plainText = getHeadingPlainText(inner)
      const slugSource = getHeadingSlugSource(inner)
      const preservedAttrs = extractHeadingAttrs(attrs)
      return processHeading(depth, inner, plainText, slugSource, preservedAttrs).trimEnd()
    })
    // Process raw HTML <a> tags for playground link collection and URL resolution
    result = result.replace(htmlAnchorRe, (_full, beforeHref, _quote, href, afterHref, inner) => {
      const label = decodeHtmlEntities(stripHtmlTags(inner).trim())
      const { resolvedHref, extraAttrs } = processLink(href, label)
      const preservedAttrs = normalizePreservedAnchorAttrs(`${beforeHref ?? ''}${afterHref ?? ''}`)
      return `<a${preservedAttrs} href="${resolvedHref}"${extraAttrs}>${inner}</a>`
    })
    return result
  }
}

// html rendering

export function renderToRawHtml({
  renderer,
  markdownBody,
  frontmatterHtml = '',
  markedInstance,
}: {
  renderer: Renderer
  markdownBody: string
  frontmatterHtml?: string
  markedInstance?: Marked
}) {
  // Strip trailing whitespace (tabs/spaces) from code block closing fences.
  // While marky-markdown handles these gracefully, marked fails to recognize
  // the end of a code block if the closing fences are followed by unexpected whitespaces.
  const normalizedContent = markdownBody.replace(/^( {0,3}(?:`{3,}|~{3,}))\s*$/gm, '$1')
  return (
    frontmatterHtml +
    ((markedInstance ?? marked).parse(normalizedContent, {
      renderer,
    }) as string)
  )
}

/// sanatizer

export const ALLOWED_ATTR: Record<string, string[]> = {
  '*': ['id'], // Allow id on all tags
  'a': ['href', 'title', 'target', 'rel', 'tabindex', 'aria-hidden'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'align'],
  'source': ['src', 'srcset', 'type', 'media'],
  'button': ['class', 'title', 'type', 'aria-label', 'data-copy'],
  'th': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'td': ['colspan', 'rowspan', 'align', 'valign', 'width'],
  'h2': ['data-level', 'align'],
  'h3': ['data-level', 'align'],
  'h4': ['data-level', 'align'],
  'h5': ['data-level', 'align'],
  'h6': ['data-level', 'align'],
  'blockquote': ['data-callout'],
  'details': ['open'],
  'code': ['class'],
  'pre': ['class'],
  'span': ['class', 'style'],
  'div': ['class', 'align'],
  'p': ['align'],
}

// allow h1-h6, but replace h1-h2 later since we shift README headings down by 2 levels
// (page h1 = package name, h2 = "Readme" section, so README h1 → h3)
export const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'a',
  'strong',
  'em',
  'del',
  's',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'img',
  'picture',
  'source',
  'details',
  'summary',
  'div',
  'span',
  'sup',
  'sub',
  'kbd',
  'mark',
  'button',
  'dl',
  'dt',
  'dd',
]

export function sanitizeRawHTML(
  rawHtml: string,
  {
    processImageUrl,
    processLink,
    toUserContentId,
    lastSemanticLevel = 2,
  }: {
    processImageUrl: ProcessImageUrlFn
    processLink: ProcessLinkFn
    toUserContentId: ToUserContentIdFn
    lastSemanticLevel?: number
  },
) {
  // Helper to prefix id attributes with 'user-content-'
  function prefixId(tagName: string, attribs: sanitizeHtml.Attributes) {
    if (attribs.id) {
      attribs.id = attribs.id.startsWith(USER_CONTENT_PREFIX)
        ? attribs.id
        : toUserContentId(attribs.id)
    }
    return { tagName, attribs }
  }

  const h1 = `h${lastSemanticLevel + 1}`,
    h2 = `h${lastSemanticLevel + 2}`,
    h3 = `h${lastSemanticLevel + 3}`,
    h4 = `h${lastSemanticLevel + 4}`

  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // disallow styles other than the ones shiki emits
    allowedStyles: {
      span: {
        'color': [/^#[0-9a-f]{3,8}$/i],
        '--shiki-light': [/^#[0-9a-f]{3,8}$/i],
      },
    },
    transformTags: {
      // Headings are already processed to correct semantic levels by processHeading()
      // during the marked rendering pass. The sanitizer just needs to preserve them.
      // For any stray headings that didn't go through processHeading (shouldn't happen),
      // we still apply a safe fallback shift.
      h1: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h1', attribs }
        return { tagName: h1, attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h2', attribs }
        return { tagName: h2, attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs }
        return { tagName: h3, attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs }
        return { tagName: h4, attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '6' } }
      },
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = processImageUrl(attribs.src)
        }
        return { tagName, attribs }
      },
      source: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = processImageUrl(attribs.src)
        }
        if (attribs.srcset) {
          attribs.srcset = attribs.srcset
            .split(',')
            .map(entry => {
              const parts = entry.trim().split(/\s+/)
              const url = parts[0]
              if (!url) return entry.trim()
              const descriptor = parts[1]
              const resolvedUrl = processImageUrl(url)
              return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
            })
            .join(', ')
        }
        return { tagName, attribs }
      },
      // Markdown links are fully processed in renderer.link (single-pass).
      // However, inline HTML <a> tags inside paragraphs are NOT seen by
      // renderer.html (marked parses them as paragraph tokens, not html tokens).
      // So we still need to collect playground links here for those cases via processUrl from readme.
      // The seenUrls set ensures no duplicates across both paths.
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        let { resolvedHref } = processLink(attribs.href, '')

        // for changelog all routes are orianted around the git provider, prefixing with $ set it to npmx
        if (resolvedHref.startsWith('$')) {
          resolvedHref = resolvedHref.replace('$', '')
        }

        // Add security attributes for external links (idempotent)
        if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
          attribs.rel = 'nofollow noreferrer noopener'
          attribs.target = '_blank'
        }
        attribs.href = resolvedHref
        return { tagName, attribs }
      },

      div: prefixId,
      p: prefixId,
      span: prefixId,
      section: prefixId,
      article: prefixId,
    },
  })
}
