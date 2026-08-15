import type { IOptions } from 'sanitize-html'
import {
  type ProcessImageUrlFn,
  type ProcessLinkFn,
  type ToUserContentIdFn,
  USER_CONTENT_PREFIX,
  blockquote,
  createCodeHighlighter,
  createHeading,
  createHtml,
  createImage,
  createLink,
  decodeHashFragment,
  isNpmJsUrlThatCanBeRedirected,
  createMarkedHeadingExtension,
  renderToRawHtml,
  sanitizeRawHTML,
} from '../mdKit'
import { slugify } from '#shared/utils/html'
import { Marked } from 'marked'
import { hasProtocol, joinRelativeURL, joinURL, parseFilename, parseURL } from 'ufo'
import { convertToEmoji } from '#shared/utils/emoji'
import sanitize from 'sanitize-html'
import { ALLOWED_ATTR } from '../mdKit'

// cl = ChangeLog
const clMarked = new Marked()

clMarked.use({
  tokenizer: {
    heading: createMarkedHeadingExtension(true),
  },
})

export async function changelogRenderer(mdRepoInfo: MarkdownRepoInfo) {
  const renderer = new clMarked.Renderer({
    gfm: true,
  })

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = blockquote

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = await createCodeHighlighter()

  return (markdownBody: string | null, releaseId?: string | number) => {
    // Collect table of contents items during parsing
    // const toc: TocItem[] = []

    if (!markdownBody) {
      return {
        html: null,
        toc: [],
      }
    }

    const idPrefix = releaseId ? `user-content-${releaseId}` : `user-content`

    const lastSemanticLevel = releaseId ? 2 : 1

    function toUserContentId(id: string) {
      return `${idPrefix}-${id}`
    }

    const processLink: ProcessLinkFn = (href: string, label: string) => {
      const resolvedHref = resolveUrl(href, mdRepoInfo, toUserContentId)

      // Security attributes for external links
      let extraAttrs =
        resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
          ? ' rel="nofollow noreferrer noopener" target="_blank"'
          : ''

      const resolvedText = resolveGitLinkText(resolvedHref, label, mdRepoInfo)

      return { resolvedHref, extraAttrs, resolvedText }
    }

    renderer.link = createLink(processLink)

    const { heading, toc, processHeading } = createHeading({
      lastSemanticLevel,
      toUserContentId,
    })
    renderer.heading = heading

    renderer.html = createHtml({ processHeading, processLink })

    const processImageUrl: ProcessImageUrlFn = href =>
      resolveImageUrl(href, mdRepoInfo, toUserContentId)

    renderer.image = createImage(processImageUrl)

    const rawHtml = renderToRawHtml({ renderer, markdownBody, markedInstance: clMarked })

    return {
      html: sanitizeRawHTML(convertToEmoji(rawHtml), {
        processImageUrl,
        processLink,
        toUserContentId,
        lastSemanticLevel,
        textFilter: createResolveGitTextToLinks(mdRepoInfo),
      }),
      toc,
    }
  }
}

export interface MarkdownRepoInfo {
  /** base url for the host */
  hostBaseUrl: string
  /** Raw file URL base (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl: string
  /** Blob/rendered file URL base (e.g., https://github.com/owner/repo/blob/HEAD) */
  blobBaseUrl: string
  /** path to the markdown file, can't start with / */
  path?: string
  /** the base url of repository commit */
  commitBaseUrl: string
  /** base url for a repository issue */
  issueBaseUrl: string
  /** the text char that indicates an issue */
  issueChar: keyof typeof issuePrRegexes
  /** base url for a repository pull/merge request */
  prBaseUrl: string
  /**
   * the text char that indicates a pull/merge request
   *
   * if it's the same as issueChar, than links will be parsed as issues and repo host is reponsible to redirect to pull/merge request
   x*/
  prChar: keyof typeof issuePrRegexes
  /** base url for a repository compare */
  compareBaseUrl: string
}

function resolveUrl(url: string, repoInfo: MarkdownRepoInfo, toUserContentId: ToUserContentIdFn) {
  if (!url || url.startsWith('$')) return url
  if (url.startsWith('#')) {
    if (url.startsWith(`#${USER_CONTENT_PREFIX}`)) {
      return url
    }
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    return `#${toUserContentId(slugify(decodeHashFragment(url.slice(1))))}`
  }
  if (hasProtocol(url, { acceptRelative: true })) {
    try {
      const parsed = new URL(url, 'https://example.com')
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        // Redirect npmjs urls to ourself
        if (isNpmJsUrlThatCanBeRedirected(parsed)) {
          // prefixing with $ to prevent sanitizing pass of making the route git based instead of npmx based
          return '$' + parsed.pathname + parsed.search + parsed.hash
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
    return checkResolvedUrl(new URL(url, `${baseUrl}/${repoInfo.path ?? ''}`).href, baseUrl)
  }

  return url
}

function resolveImageUrl(
  url: string,
  repoInfo: MarkdownRepoInfo,
  toUserContentId: ToUserContentIdFn,
): string {
  // Skip already-proxied URLs (from a previous resolveImageUrl call in the
  // marked renderer — sanitizeHtml transformTags may call this again)
  if (url.startsWith('/api/registry/image-proxy')) {
    return url
  }
  const rawUrl = resolveUrl(url, repoInfo, toUserContentId)
  const { imageProxySecret } = useRuntimeConfig()
  return toProxiedImageUrl(rawUrl, imageProxySecret)
}

/**
 * check resolved url that it still contains the base url
 * @returns the resolved url if starting with baseUrl else baseUrl/filename.ext
 */
function checkResolvedUrl(resolved: string, baseUrl: string) {
  if (resolved.startsWith(baseUrl)) {
    return resolved
  }
  return joinRelativeURL(baseUrl, parseFilename(resolved) ?? '')
}

function resolveGitLinkText(href: string, label: string, repoInfo: MarkdownRepoInfo) {
  if (!href || label !== href) {
    // is autoLink or empty href
    return
  }

  const pathSegments = parseURL(href).pathname.split('/').filter(Boolean)
  const lastSegment = pathSegments.at(-1)
  if (!lastSegment) {
    return
  }

  switch (true) {
    case href.startsWith(repoInfo.commitBaseUrl): {
      return lastSegment.slice(0, 7) // only show the first 6 letters/numbers of a commit
    }
    case href.startsWith(repoInfo.issueBaseUrl): {
      return `${repoInfo.issueChar}${lastSegment}`
    }
    case href.startsWith(repoInfo.prBaseUrl): {
      return `${repoInfo.prChar}${lastSegment}`
    }
    case href.startsWith(repoInfo.compareBaseUrl): {
      return lastSegment
    }
    // for account we don't resolve, this is something the git providers also don't do
  }
}

const issuePrRegexes = {
  '#': /\B#\d+\b/g,
  '!': /\B!\d+\b/g,
} as const

const accountRegex = /\B@(?![\d.]+\b)(?![\w.-]*\/)[\w\-.]+\b/g
const commitRegex = /(?<![@#!])\b[a-f0-9]{6,40}\b/gi

const tagsToIgnore = new Set(['a', 'code'])
function createResolveGitTextToLinks(mdInfo: MarkdownRepoInfo): IOptions['textFilter'] {
  return (text, tag) => {
    if (tagsToIgnore.has(tag)) return text

    // issues
    text = text
      // commits come first to prevent matching issue/pr that has been formatted
      .replace(commitRegex, match => {
        if (excludeWordsFromCommitMatch.has(match.toLowerCase())) {
          return match
        }

        return `<a href="${joinURL(mdInfo.commitBaseUrl, match)}" rel="nofollow noreferrer noopener" target="_blank">${match.slice(0, 7)}</a>`
      })
      .replace(issuePrRegexes[mdInfo.issueChar], match => {
        const id = match.replace(mdInfo.issueChar, '')
        return `<a href="${joinURL(mdInfo.issueBaseUrl, id)}" rel="nofollow noreferrer noopener" target="_blank">${match}</a>`
      })
      // account
      .replace(accountRegex, match => {
        const acc = match.replace('@', '')
        return `<a href="${joinURL(mdInfo.hostBaseUrl, acc)}" rel="nofollow noreferrer noopener" target="_blank">${match}</a>`
      })

    // pr/mr
    if (mdInfo.issueChar != mdInfo.prChar) {
      text = text.replace(issuePrRegexes[mdInfo.prChar], match => {
        const id = match.replace(mdInfo.prChar, '')
        return `<a href="${joinURL(mdInfo.prBaseUrl, id)}" rel="nofollow noreferrer noopener" target="_blank">${match}</a>`
      })
    }

    return sanitize(text, {
      allowedAttributes: ALLOWED_ATTR,
      allowedSchemes: ['http', 'https', 'mailto'],
    })
  }
}

// source https://raw.githubusercontent.com/potch/sowpods/refs/heads/master/SOWPODS.txt and filtered with /^[a-f]{6,40}$/i
const excludeWordsFromCommitMatch = new Set([
  'accede',
  'acceded',
  'baccae',
  'baffed',
  'beaded',
  'bedded',
  'beebee',
  'beefed',
  'cabbed',
  'dabbed',
  'dadded',
  'daffed',
  'deaded',
  'decade',
  'decaff',
  'deeded',
  'deface',
  'defaced',
  'efface',
  'effaced',
  'facade',
  'faffed',
])
