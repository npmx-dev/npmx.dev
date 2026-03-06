import { type Tokens, marked } from 'marked'
import {
  type prefixId as prefixIdFn,
  ALLOWED_ATTR,
  ALLOWED_TAGS,
  calculateSemanticDepth,
  isNpmJsUrlThatCanBeRedirected,
  slugify,
} from '../readme'
import { stripHtmlTags } from '#shared/utils/html'
import sanitizeHtml from 'sanitize-html'
import { hasProtocol } from 'ufo'

const EMAIL_REGEX = /^[\w+\-.]+@[\w\-.]+\.[a-z]+$/i

export async function changelogRenderer(mdRepoInfo: MarkdownRepoInfo) {
  const renderer = new marked.Renderer({
    gfm: true,
  })

  const shiki = await getShikiHighlighter()

  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''
    const plainText = text.replace(/<[^>]*>/g, '').trim()

    if (href.startsWith('mailto:') && !EMAIL_REGEX.test(plainText)) {
      return text
    }

    const intermediateTitleAttr = `data-title-intermediate="${plainText || title}"`

    return `<a href="${href}"${titleAttr}${intermediateTitleAttr} target="_blank">${text}</a>`
  }

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = function ({ tokens }: Tokens.Blockquote) {
    const body = this.parser.parse(tokens)

    const calloutMatch = body.match(/^<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:<br>)?\s*/i)

    if (calloutMatch?.[1]) {
      const calloutType = calloutMatch[1].toLowerCase()
      const cleanedBody = body.replace(calloutMatch[0], '<p>')
      return `<blockquote data-callout="${calloutType}">${cleanedBody}</blockquote>\n`
    }

    return `<blockquote>${body}</blockquote>\n`
  }

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const html = highlightCodeSync(shiki, text, lang || 'text')
    // Add copy button
    return `<div class="readme-code-block" >
  <button type="button" class="readme-copy-button" aria-label="Copy code" check-icon="i-carbon:checkmark" copy-icon="i-carbon:copy" data-copy>
  <span class="i-carbon:copy" aria-hidden="true"></span>
  <span class="sr-only">Copy code</span>
  </button>
  ${html}
  </div>`
  }

  return (markdown: string | null, releaseId?: string | number) => {
    // Collect table of contents items during parsing
    const toc: TocItem[] = []

    if (!markdown) {
      return {
        html: null,
        toc,
      }
    }

    const idPrefix = releaseId ? `user-content-${releaseId}` : `user-content`

    // Track used heading slugs to handle duplicates (GitHub-style: foo, foo-1, foo-2)
    const usedSlugs = new Map<string, number>()

    let lastSemanticLevel = releaseId ? 2 : 1 // Start after h2 (the "Readme" section heading)
    renderer.heading = function ({ tokens, depth }: Tokens.Heading) {
      // Calculate the target semantic level based on document structure
      // Start at h3 (since page h1 + section h2 already exist)
      // But ensure we never skip levels - can only go down by 1 or stay same/go up
      const semanticLevel = calculateSemanticDepth(depth, lastSemanticLevel)
      lastSemanticLevel = semanticLevel
      const text = this.parser.parseInline(tokens)

      // Generate GitHub-style slug for anchor links
      // adding release id to prevent conflicts
      let slug = slugify(text)
      if (!slug) slug = 'heading' // Fallback for empty headings

      // Handle duplicate slugs (GitHub-style: foo, foo-1, foo-2)
      const count = usedSlugs.get(slug) ?? 0
      usedSlugs.set(slug, count + 1)
      const uniqueSlug = count === 0 ? slug : `${slug}-${count}`

      // Prefix with 'user-content-' to avoid collisions with page IDs
      // (e.g., #install, #dependencies, #versions are used by the package page)
      const id = `${idPrefix}-${uniqueSlug}`

      // Collect TOC item with plain text (HTML stripped & emoji's added)
      const plainText = convertToEmoji(stripHtmlTags(text))
        .replace(/&nbsp;?/g, '') // remove non breaking spaces
        .trim()
      if (plainText) {
        toc.push({ text: plainText, id, depth })
      }

      return `<h${semanticLevel} id="${id}" data-level="${depth}">${text}  <a content-none href="#${id}"><span class="i-lucide:link size-[1em]" aria-hidden="true"></span></a></h${semanticLevel}>\n`
    }

    // Helper to prefix id attributes with 'user-content-'
    const prefixId: typeof prefixIdFn = (tagName: string, attribs: sanitizeHtml.Attributes) => {
      if (attribs.id && !attribs.id.startsWith('user-content-')) {
        attribs.id = `${idPrefix}-${attribs.id}`
      }
      return { tagName, attribs }
    }

    return {
      html: sanitizeRawHTML(
        convertToEmoji(
          marked.parse(markdown, {
            renderer,
          }) as string,
        ),
        mdRepoInfo,
        prefixId,
      ),
      toc,
    }
  }
}

export function sanitizeRawHTML(
  rawHtml: string,
  mdRepoInfo: MarkdownRepoInfo,
  prefixId: typeof prefixIdFn,
) {
  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTR,
    allowedSchemes: ['http', 'https', 'mailto'],
    // Transform img src URLs (GitHub blob → raw, relative → GitHub raw)
    transformTags: {
      h1: (_, attribs) => {
        return { tagName: 'h3', attribs: { ...attribs, 'data-level': '1' } }
      },
      h2: (_, attribs) => {
        return { tagName: 'h4', attribs: { ...attribs, 'data-level': '2' } }
      },
      h3: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h3', attribs: attribs }
        return { tagName: 'h5', attribs: { ...attribs, 'data-level': '3' } }
      },
      h4: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h4', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '4' } }
      },
      h5: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h5', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '5' } }
      },
      h6: (_, attribs) => {
        if (attribs['data-level']) return { tagName: 'h6', attribs: attribs }
        return { tagName: 'h6', attribs: { ...attribs, 'data-level': '6' } }
      },
      img: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveUrl(attribs.src, mdRepoInfo)
        }
        return { tagName, attribs }
      },
      source: (tagName, attribs) => {
        if (attribs.src) {
          attribs.src = resolveUrl(attribs.src, mdRepoInfo)
        }
        if (attribs.srcset) {
          attribs.srcset = attribs.srcset
            .split(',')
            .map(entry => {
              const parts = entry.trim().split(/\s+/)
              const url = parts[0]
              if (!url) return entry.trim()
              const descriptor = parts[1]
              const resolvedUrl = resolveUrl(url, mdRepoInfo)
              return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
            })
            .join(', ')
        }
        return { tagName, attribs }
      },
      a: (tagName, attribs) => {
        if (!attribs.href) {
          return { tagName, attribs }
        }

        const resolvedHref = resolveUrl(attribs.href, mdRepoInfo)

        // Add security attributes for external links
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

interface MarkdownRepoInfo {
  /** Raw file URL base (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl: string
  /** Blob/rendered file URL base (e.g., https://github.com/owner/repo/blob/HEAD) */
  blobBaseUrl: string
  /**
   * path to the markdown file, can't start with /
   */
  path?: string
}

function resolveUrl(url: string, repoInfo: MarkdownRepoInfo) {
  if (!url) return url
  if (url.startsWith('#')) {
    if (url.startsWith('#user-content')) {
      return url
    }
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    return `#user-content-${url.slice(1)}`
  }
  if (hasProtocol(url, { acceptRelative: true })) {
    try {
      const parsed = new URL(url, 'https://example.com')
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Redirect npmjs urls to ourself
        if (isNpmJsUrlThatCanBeRedirected(parsed)) {
          return parsed.pathname + parsed.search + parsed.hash
        }
        return url
      }
    } catch {
      // Invalid URL, fall through to resolve as relative
    }
    // return protocol-relative URLs (//example.com) as-is
    if (url.startsWith('//')) {
      return url
    }
    // for non-HTTP protocols (javascript:, data:, etc.), don't return, treat as relative
  }

  // Check if this is a markdown file link
  const isMarkdownFile = /\.md$/i.test(url.split('?')[0]?.split('#')[0] ?? '')
  const baseUrl = isMarkdownFile ? repoInfo.blobBaseUrl : repoInfo.rawBaseUrl

  if (url.startsWith('/')) {
    return checkResolvedUrl(new URL(`${baseUrl}${url}`).href, baseUrl)
  }

  if (!hasProtocol(url)) {
    // the '/' ensure bare relative links stay after "....../HEAD"
    return checkResolvedUrl(new URL(url, `${baseUrl}/${repoInfo.path ?? '/'}`).href, baseUrl)
  }

  return url
}

/**
 * check resolved url that it still contains the base url
 * @returns the resolved url if starting with baseUrl else baseUrl
 */
function checkResolvedUrl(resolved: string, baseUrl: string) {
  if (resolved.startsWith(baseUrl)) {
    return resolved
  }
  return baseUrl
}
