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
import { hasProtocol, joinRelativeURL, parseFilename } from 'ufo'
import { convertToEmoji } from '#shared/utils/emoji'

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

    const processLink: ProcessLinkFn = (href: string, _label: string) => {
      const resolvedHref = resolveUrl(href, mdRepoInfo, toUserContentId)

      // Security attributes for external links
      let extraAttrs =
        resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
          ? ' rel="nofollow noreferrer noopener" target="_blank"'
          : ''

      return { resolvedHref, extraAttrs }
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
      }),
      toc,
    }
  }
}

export interface MarkdownRepoInfo {
  /** Raw file URL base (e.g., https://raw.githubusercontent.com/owner/repo/HEAD) */
  rawBaseUrl: string
  /** Blob/rendered file URL base (e.g., https://github.com/owner/repo/blob/HEAD) */
  blobBaseUrl: string
  /**
   * path to the markdown file, can't start with /
   */
  path?: string
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
