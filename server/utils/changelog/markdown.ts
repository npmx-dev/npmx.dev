import { marked, type Tokens } from 'marked'
import { ALLOWED_ATTR, ALLOWED_TAGS, calculateSemanticDepth, prefixId, slugify } from '../readme'
import sanitizeHtml from 'sanitize-html'

export async function changelogRenderer() {
  const renderer = new marked.Renderer({
    gfm: true,
  })

  const shiki = await getShikiHighlighter()

  renderer.link = function ({ href, title, tokens }: Tokens.Link) {
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''
    const plainText = text.replace(/<[^>]*>/g, '').trim()

    const intermediateTitleAttr = `${` data-title-intermediate="${plainText || title}"`}`

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
      const id = releaseId
        ? `user-content-${releaseId}-${uniqueSlug}`
        : `user-content-${uniqueSlug}`

      // Collect TOC item with plain text (HTML stripped)
      const plainText = text
        .replace(/<[^>]*>/g, '')
        // remove non breaking spaces
        .replace(/&nbsp;?/g, '')
        .trim()
      if (plainText) {
        toc.push({ text: plainText, id, depth })
      }

      return `<h${semanticLevel} id="${id}" data-level="${depth}">${text}</h${semanticLevel}>\n`
    }

    return {
      html: marked.parse(markdown, {
        renderer,
      }) as string,
      toc,
    }
  }
}

export function sanitizeRawHTML(rawHtml: string) {
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
      // img: (tagName, attribs) => {
      //   if (attribs.src) {
      //     attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
      //   }
      //   return { tagName, attribs }
      // },
      // source: (tagName, attribs) => {
      //   if (attribs.src) {
      //     attribs.src = resolveImageUrl(attribs.src, packageName, repoInfo)
      //   }
      //   if (attribs.srcset) {
      //     attribs.srcset = attribs.srcset
      //       .split(',')
      //       .map(entry => {
      //         const parts = entry.trim().split(/\s+/)
      //         const url = parts[0]
      //         if (!url) return entry.trim()
      //         const descriptor = parts[1]
      //         const resolvedUrl = resolveImageUrl(url, packageName, repoInfo)
      //         return descriptor ? `${resolvedUrl} ${descriptor}` : resolvedUrl
      //       })
      //       .join(', ')
      //   }
      //   return { tagName, attribs }
      // },
      // a: (tagName, attribs) => {
      //   if (!attribs.href) {
      //     return { tagName, attribs }
      //   }

      //   const resolvedHref = resolveUrl(attribs.href, packageName, repoInfo)

      //   const provider = matchPlaygroundProvider(resolvedHref)
      //   if (provider && !seenUrls.has(resolvedHref)) {
      //     seenUrls.add(resolvedHref)

      //     collectedLinks.push({
      //       url: resolvedHref,
      //       provider: provider.id,
      //       providerName: provider.name,
      //       /**
      //        * We need to set some data attribute before hand because `transformTags` doesn't
      //        * provide the text of the element. This will automatically be removed, because there
      //        * is an allow list for link attributes.
      //        * */
      //       label: attribs['data-title-intermediate'] || provider.name,
      //     })
      //   }

      //   // Add security attributes for external links
      //   if (resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })) {
      //     attribs.rel = 'nofollow noreferrer noopener'
      //     attribs.target = '_blank'
      //   }
      //   attribs.href = resolvedHref
      //   return { tagName, attribs }
      // },
      div: prefixId,
      p: prefixId,
      span: prefixId,
      section: prefixId,
      article: prefixId,
    },
  })
}
