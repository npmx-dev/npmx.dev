import type { ReadmeResponse } from '#shared/types/readme'
import {
  type ProcessLinkFn,
  blockquote,
  createCodeHighlighter,
  isNpmJsUrlThatCanBeRedirected,
  createLink,
  createHeading,
  createHtml,
  USER_CONTENT_PREFIX,
  createMarkedHeadingExtension,
  renderToRawHtml,
  createImage,
  sanitizeRawHTML,
  decodeHashFragment,
} from './mdKit'
import type { UrlTarget } from 'forges'
import matter from 'gray-matter'
import { marked } from 'marked'
import { hasProtocol } from 'ufo'
import { convertBlobOrFileToRawUrl, forgeWeb, toForgeRepoRef } from '#shared/utils/forges'
import type { RepositoryInfo } from '#shared/utils/git-providers'
import { decodeHtmlEntities, slugify } from '#shared/utils/html'
import { convertToEmoji } from '#shared/utils/emoji'
import { toProxiedImageUrl } from '#server/utils/image-proxy'
import { escapeHtml } from './docs/text'

/**
 * Playground provider configuration
 */
interface PlaygroundProvider {
  id: string // Provider identifier
  name: string
  domains: string[] // Associated domains
  paths?: string[]
  icon?: string // Provider icon name
}

/**
 * Known playground/demo providers
 */
const PLAYGROUND_PROVIDERS: PlaygroundProvider[] = [
  {
    id: 'stackblitz',
    name: 'StackBlitz',
    domains: ['stackblitz.com', 'stackblitz.io'],
    icon: 'stackblitz',
  },
  {
    id: 'codesandbox',
    name: 'CodeSandbox',
    domains: ['codesandbox.io', 'githubbox.com', 'csb.app'],
    icon: 'codesandbox',
  },
  {
    id: 'codepen',
    name: 'CodePen',
    domains: ['codepen.io'],
    icon: 'codepen',
  },
  {
    id: 'jsfiddle',
    name: 'JSFiddle',
    domains: ['jsfiddle.net'],
    icon: 'jsfiddle',
  },
  {
    id: 'replit',
    name: 'Replit',
    domains: ['repl.it', 'replit.com'],
    icon: 'replit',
  },
  {
    id: 'gitpod',
    name: 'Gitpod',
    domains: ['gitpod.io'],
    icon: 'gitpod',
  },
  {
    id: 'vue-playground',
    name: 'Vue Playground',
    domains: ['play.vuejs.org', 'sfc.vuejs.org'],
    icon: 'vue',
  },
  {
    id: 'nuxt-new',
    name: 'Nuxt Starter',
    domains: ['nuxt.new'],
    icon: 'nuxt',
  },
  {
    id: 'vite-new',
    name: 'Vite Starter',
    domains: ['vite.new'],
    icon: 'vite',
  },
  {
    id: 'typescript-playground',
    name: 'TypeScript Playground',
    domains: ['typescriptlang.org'],
    paths: ['/play'],
    icon: 'typescript',
  },
  {
    id: 'effect-ts-playground',
    name: 'Effect.ts Playground',
    domains: ['effect.website'],
    paths: ['/play'],
    icon: 'effect',
  },
  {
    id: 'solid-playground',
    name: 'Solid Playground',
    domains: ['playground.solidjs.com'],
    icon: 'solid',
  },
  {
    id: 'svelte-playground',
    name: 'Svelte Playground',
    domains: ['svelte.dev'],
    paths: ['/repl', '/playground'],
    icon: 'svelte',
  },
  {
    id: 'tailwind-playground',
    name: 'Tailwind Play',
    domains: ['play.tailwindcss.com'],
    icon: 'tailwindcss',
  },
  {
    id: 'marko-playground',
    name: 'Marko Playground',
    domains: ['markojs.com'],
    paths: ['/playground'],
    icon: 'marko',
  },
]

/**
 * Check if a URL is a playground link and return provider info
 */
function matchPlaygroundProvider(url: string): PlaygroundProvider | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    for (const provider of PLAYGROUND_PROVIDERS) {
      for (const domain of provider.domains) {
        if (
          (hostname === domain || hostname.endsWith(`.${domain}`)) &&
          (!provider.paths || provider.paths.some(path => parsed.pathname.startsWith(path)))
        ) {
          return provider
        }
      }
    }
  } catch {
    // Invalid URL
  }
  return null
}

marked.use({
  tokenizer: {
    heading: createMarkedHeadingExtension(),
  },
})

function withUserContentPrefix(value: string): string {
  return value.startsWith(USER_CONTENT_PREFIX) ? value : `${USER_CONTENT_PREFIX}${value}`
}

function toUserContentId(value: string): string {
  return `${USER_CONTENT_PREFIX}${value}`
}

function toUserContentHash(value: string): string {
  return `#${withUserContentPrefix(value)}`
}

/**
 * Resolve a relative URL to an absolute URL.
 *
 * With repository info, a relative path resolves through the forge, which serves
 * assets that are not in the npm tarball. Markdown files link to the rendered
 * page so they open properly; everything else links to raw bytes. Without
 * repository info, non-markdown files fall back to the jsdelivr CDN.
 *
 * `revision` is the commit the README was published from, so its links match the
 * content on show.
 */
function resolveUrl(
  url: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
  revision?: string,
): string {
  if (!url) return url
  if (url.startsWith('#')) {
    // Prefix anchor links to match heading IDs (avoids collision with page IDs)
    // Normalize markdown-style heading fragments to the same slug format used
    // for generated README heading IDs, but leave already-prefixed values as-is.
    const fragment = url.slice(1)
    if (!fragment) {
      return '#'
    }
    if (fragment.startsWith(USER_CONTENT_PREFIX)) {
      return `#${fragment}`
    }

    const normalizedFragment = slugify(decodeHashFragment(fragment))
    return toUserContentHash(normalizedFragment || fragment)
  }
  // Absolute paths (e.g. /package/foo from a previous npmjs redirect) are already resolved
  if (url.startsWith('/')) return url
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

  if (repoInfo) {
    const resolved = forgeFileUrl(repoInfo, url, isMarkdownFile, revision)
    if (resolved) {
      return resolved
    }
  }

  // For markdown files without repo info, leave unchanged (like npm does)
  // This avoids 404s from jsdelivr which doesn't render markdown
  if (isMarkdownFile) {
    return url
  }

  // Fallback: relative URLs → jsdelivr CDN (may 404 if asset not in npm tarball)
  return `https://cdn.jsdelivr.net/npm/${packageName}/${url.replace(/^\.\//, '')}`
}

/**
 * The forge's URL for a file in the repository, or `undefined` where the forge
 * has no such page. A markdown file links to its rendered page, anything else to
 * its bytes, and the query and fragment a relative link carried are kept.
 */
function forgeFileUrl(
  repoInfo: RepositoryInfo,
  url: string,
  asPage: boolean,
  revision?: string,
): string | undefined {
  // `match[0]` is the whole match, so the groups start at 1.
  const match = /^([^?#]*)([?#].*)?$/.exec(url)
  const rawPath = match?.[1] ?? url
  const suffix = match?.[2] ?? ''
  let path = rawPath.replace(/^\.\//, '')

  // If the package is in a subdirectory, resolve relative paths from there:
  // for packages/ai, ./assets/hero.gif is packages/ai/assets/hero.gif, and
  // ../../.github/banner.jpg climbs back out of it.
  if (repoInfo.directory) {
    const parts = repoInfo.directory.split('/').filter(Boolean)
    while (path.startsWith('../')) {
      path = path.slice(3)
      parts.pop()
    }
    if (parts.length > 0) {
      path = `${parts.join('/')}/${path}`
    }
  }

  const repo = toForgeRepoRef(repoInfo)
  const at = revision ?? 'HEAD'
  const target: UrlTarget = asPage ? { file: { repo, path, at } } : { raw: { repo, path, at } }
  const resolved = forgeWeb(repoInfo)?.urlFor(target)
  return resolved ? `${resolved}${suffix}` : undefined
}

// Convert blob/src URLs to raw URLs for images across all providers
// e.g. https://github.com/nuxt/nuxt/blob/main/.github/assets/banner.svg
//   → https://github.com/nuxt/nuxt/raw/main/.github/assets/banner.svg
//
// External images are proxied through /api/registry/image-proxy to prevent
// third-party servers from collecting visitor IP addresses and User-Agent data.
// Proxy URLs are HMAC-signed to prevent open proxy abuse.
// See: https://github.com/npmx-dev/npmx.dev/issues/1138
function resolveImageUrl(
  url: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
  revision?: string,
): string {
  // Skip already-proxied URLs (from a previous resolveImageUrl call in the
  // marked renderer — sanitizeHtml transformTags may call this again)
  if (url.startsWith('/api/registry/image-proxy')) {
    return url
  }
  const resolved = resolveUrl(url, packageName, repoInfo, revision)
  const rawUrl = repoInfo?.provider ? convertBlobOrFileToRawUrl(resolved, repoInfo) : resolved
  const { imageProxySecret } = useRuntimeConfig()
  return toProxiedImageUrl(rawUrl, imageProxySecret)
}

/**
 * Render YAML frontmatter as a GitHub-style key-value table.
 */
function renderFrontmatterTable(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
  if (entries.length === 0) return ''

  const rows = entries
    .map(([key, value]) => {
      const displayValue =
        typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')
      return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(displayValue)}</td></tr>`
    })
    .join('\n')
  return `<table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody>\n${rows}\n</tbody></table>\n`
}

export async function renderReadmeHtml(
  content: string,
  packageName: string,
  repoInfo?: RepositoryInfo,
  revision?: string,
): Promise<ReadmeResponse> {
  if (!content) return { html: '', playgroundLinks: [], toc: [] }

  // Parse and strip YAML frontmatter, render as table if present
  let markdownBody = content
  let frontmatterHtml = ''
  try {
    const { data, content: body } = matter(content)
    if (data && Object.keys(data).length > 0) {
      frontmatterHtml = renderFrontmatterTable(data)
      markdownBody = body
    }
  } catch {
    // If frontmatter parsing fails, render the full content as-is
  }

  const renderer = new marked.Renderer()

  // Collect playground links during parsing
  const collectedLinks: PlaygroundLink[] = []
  const seenUrls = new Set<string>()

  const { toc, heading, processHeading } = createHeading({ toUserContentId })

  renderer.heading = heading

  // Syntax highlighting for code blocks (uses shared highlighter)
  renderer.code = await createCodeHighlighter()

  function processImageUrl(href: string) {
    return resolveImageUrl(href, packageName, repoInfo, revision)
  }

  renderer.image = createImage(processImageUrl)

  // Helper: resolve a link href, collect playground links, and build <a> attributes.
  // Used by both the markdown renderer.link and the HTML <a> interceptor so that
  // all link processing happens in a single pass during marked rendering.
  const processLink: ProcessLinkFn = (href: string, label: string) => {
    const resolvedHref = resolveUrl(href, packageName, repoInfo, revision)

    // Collect playground links
    const provider = matchPlaygroundProvider(resolvedHref)
    if (provider && !seenUrls.has(resolvedHref)) {
      seenUrls.add(resolvedHref)
      collectedLinks.push({
        url: resolvedHref,
        provider: provider.id,
        providerName: provider.name,
        label: decodeHtmlEntities(label || provider.name),
      })
    }

    // Security attributes for external links
    const extraAttrs =
      resolvedHref && hasProtocol(resolvedHref, { acceptRelative: true })
        ? ' rel="nofollow noreferrer noopener" target="_blank"'
        : ''

    return { resolvedHref, extraAttrs }
  }

  renderer.link = createLink(processLink)
  renderer.html = createHtml({ processHeading, processLink })

  // GitHub-style callouts: > [!NOTE], > [!TIP], etc.
  renderer.blockquote = blockquote

  const rawHtml = renderToRawHtml({ renderer, markdownBody, frontmatterHtml })

  const sanitized = sanitizeRawHTML(rawHtml, {
    processImageUrl,
    processLink,
    toUserContentId,
  })

  return {
    html: convertToEmoji(sanitized),
    mdExists: Boolean(content),
    playgroundLinks: collectedLinks,
    toc,
  }
}
