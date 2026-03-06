import type { RepositoryInfo } from '#shared/utils/git-providers'
import { describe, expect, it, vi, beforeAll } from 'vitest'

// Mock the global Nuxt auto-imports before importing the module
beforeAll(() => {
  vi.stubGlobal(
    'getShikiHighlighter',
    vi.fn().mockResolvedValue({
      getLoadedLanguages: () => [],
      codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
    }),
  )
  vi.stubGlobal(
    'useRuntimeConfig',
    vi.fn().mockReturnValue({
      imageProxySecret: 'test-secret-for-readme-tests',
    }),
  )
})

// Import after mock is set up
const { renderReadmeHtml } = await import('../../../../server/utils/readme')

// Helper to create mock repository info
function createRepoInfo(overrides?: Partial<RepositoryInfo>): RepositoryInfo {
  return {
    provider: 'github',
    owner: 'test-owner',
    repo: 'test-repo',
    rawBaseUrl: 'https://raw.githubusercontent.com/test-owner/test-repo/HEAD',
    blobBaseUrl: 'https://github.com/test-owner/test-repo/blob/HEAD',
    ...overrides,
  }
}

describe('Playground Link Extraction', () => {
  describe('StackBlitz', () => {
    it('extracts stackblitz.com links', async () => {
      const markdown = `Check out [Demo on StackBlitz](https://stackblitz.com/github/user/repo)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
      expect(result.playgroundLinks[0]).toMatchObject({
        provider: 'stackblitz',
        providerName: 'StackBlitz',
        label: 'Demo on StackBlitz',
        url: 'https://stackblitz.com/github/user/repo',
      })
    })
  })

  describe('CodeSandbox', () => {
    it('extracts codesandbox.io links', async () => {
      const markdown = `[Try it](https://codesandbox.io/s/example-abc123)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
      expect(result.playgroundLinks[0]).toMatchObject({
        provider: 'codesandbox',
        providerName: 'CodeSandbox',
      })
    })

    it('extracts githubbox.com links as CodeSandbox', async () => {
      const markdown = `[Demo](https://githubbox.com/user/repo/tree/main/examples)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
      expect(result.playgroundLinks[0]!.provider).toBe('codesandbox')
    })

    it('extracts label from image link', async () => {
      const markdown = `[![Edit CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/example-abc123)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
      expect(result.playgroundLinks[0]).toMatchObject({
        provider: 'codesandbox',
        providerName: 'CodeSandbox',
        label: 'Edit CodeSandbox',
        url: 'https://codesandbox.io/s/example-abc123',
      })
    })
  })

  describe('Other Providers', () => {
    it('extracts CodePen links', async () => {
      const markdown = `[Pen](https://codepen.io/user/pen/abc123)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks[0]!.provider).toBe('codepen')
    })

    it('extracts Replit links', async () => {
      const markdown = `[Repl](https://replit.com/@user/project)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks[0]!.provider).toBe('replit')
    })

    it('extracts Gitpod links', async () => {
      const markdown = `[Open in Gitpod](https://gitpod.io/#https://github.com/user/repo)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks[0]!.provider).toBe('gitpod')
    })
  })

  describe('Multiple Links', () => {
    it('extracts multiple playground links', async () => {
      const markdown = `
- [StackBlitz](https://stackblitz.com/example1)
- [CodeSandbox](https://codesandbox.io/s/example2)
`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(2)
      expect(result.playgroundLinks[0]!.provider).toBe('stackblitz')
      expect(result.playgroundLinks[1]!.provider).toBe('codesandbox')
    })

    it('deduplicates same URL', async () => {
      const markdown = `
[Demo 1](https://stackblitz.com/example)
[Demo 2](https://stackblitz.com/example)
`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
    })
  })

  describe('Non-Playground Links', () => {
    it('ignores regular GitHub links', async () => {
      const markdown = `[Repo](https://github.com/user/repo)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(0)
    })

    it('ignores npm links', async () => {
      const markdown = `[Package](https://npmjs.com/package/test)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(0)
    })
  })

  describe('Edge Cases', () => {
    it('returns empty array for empty content', async () => {
      const result = await renderReadmeHtml('', 'test-pkg')

      expect(result.playgroundLinks).toEqual([])
      expect(result.html).toBe('')
    })

    it('handles badge images wrapped in links', async () => {
      const markdown = `[![Open in StackBlitz](https://img.shields.io/badge/Open-StackBlitz-blue)](https://stackblitz.com/example)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.playgroundLinks).toHaveLength(1)
      expect(result.playgroundLinks[0]!.provider).toBe('stackblitz')
    })
  })
})

describe('Markdown File URL Resolution', () => {
  describe('with repository info', () => {
    it('resolves relative .md links to blob URL for rendered viewing', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md"',
      )
    })

    it('resolves relative .MD links (uppercase) to blob URL', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[Guide](./GUIDE.MD)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/GUIDE.MD"',
      )
    })

    it('resolves nested relative .md links to blob URL', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[API Docs](./docs/api/reference.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/docs/api/reference.md"',
      )
    })

    it('resolves relative .md links with query strings to blob URL', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[FAQ](./FAQ.md?ref=main)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/FAQ.md?ref=main"',
      )
    })

    it('resolves relative .md links with anchors to blob URL', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[Install Section](./CONTRIBUTING.md#installation)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md#installation"',
      )
    })

    it('resolves non-.md files to raw URL (not blob)', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[Image](./assets/logo.png)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/assets/logo.png"',
      )
    })

    it('handles monorepo directory for .md links', async () => {
      const repoInfo = createRepoInfo({
        directory: 'packages/core',
      })
      const markdown = `[Changelog](./CHANGELOG.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/core/CHANGELOG.md"',
      )
    })

    it('handles parent directory navigation for .md links', async () => {
      const repoInfo = createRepoInfo({
        directory: 'packages/core',
      })
      const markdown = `[Root Contributing](../../CONTRIBUTING.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md"',
      )
    })
  })

  describe('without repository info', () => {
    it('leaves relative .md links unchanged (no jsdelivr fallback)', async () => {
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      // Should remain unchanged, not converted to jsdelivr
      expect(result.html).toContain('href="./CONTRIBUTING.md"')
    })

    it('resolves non-.md files to jsdelivr CDN', async () => {
      const markdown = `[Schema](./schema.json)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="https://cdn.jsdelivr.net/npm/test-pkg/schema.json"')
    })
  })

  describe('absolute URLs', () => {
    it('leaves absolute .md URLs unchanged', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[External Guide](https://example.com/guide.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain('href="https://example.com/guide.md"')
    })

    it('leaves absolute non-.md URLs unchanged', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `[Docs](https://docs.example.com/)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain('href="https://docs.example.com/"')
    })
  })

  describe('anchor links', () => {
    it('prefixes anchor links with user-content-', async () => {
      const markdown = `[Jump to section](#installation)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="#user-content-installation"')
    })
  })

  describe('different git providers', () => {
    it('uses correct blob URL format for GitLab', async () => {
      const repoInfo = createRepoInfo({
        provider: 'gitlab',
        host: 'gitlab.com',
        rawBaseUrl: 'https://gitlab.com/owner/repo/-/raw/HEAD',
        blobBaseUrl: 'https://gitlab.com/owner/repo/-/blob/HEAD',
      })
      const markdown = `[Docs](./docs/guide.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://gitlab.com/owner/repo/-/blob/HEAD/docs/guide.md"',
      )
    })

    it('uses correct blob URL format for Bitbucket', async () => {
      const repoInfo = createRepoInfo({
        provider: 'bitbucket',
        rawBaseUrl: 'https://bitbucket.org/owner/repo/raw/HEAD',
        blobBaseUrl: 'https://bitbucket.org/owner/repo/src/HEAD',
      })
      const markdown = `[Readme](./other/README.md)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'href="https://bitbucket.org/owner/repo/src/HEAD/other/README.md"',
      )
    })
  })

  describe('npm.js urls', () => {
    it('redirects npmjs.com urls to local', async () => {
      const markdown = `[Some npmjs.com link](https://www.npmjs.com/package/test-pkg)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.com urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.com link](http://npmjs.com/package/test-pkg)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('does not redirect npmjs.com to local if they are in the list of exceptions', async () => {
      const markdown = `[Root Contributing](https://www.npmjs.com/products)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="https://www.npmjs.com/products"')
    })

    it('redirects npmjs.org urls to local', async () => {
      const markdown = `[Some npmjs.org link](https://www.npmjs.org/package/test-pkg)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.org urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.org link](http://npmjs.org/package/test-pkg)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('href="/package/test-pkg"')
    })
  })
})

describe('Image Privacy Proxy', () => {
  describe('trusted domains (not proxied)', () => {
    it('does not proxy GitHub raw content images', async () => {
      const repoInfo = createRepoInfo()
      const markdown = `![logo](./assets/logo.png)`
      const result = await renderReadmeHtml(markdown, 'test-pkg', repoInfo)

      expect(result.html).toContain(
        'src="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/assets/logo.png"',
      )
      expect(result.html).not.toContain('/api/registry/image-proxy')
    })

    it('does not proxy shields.io badge images', async () => {
      const markdown = `![badge](https://img.shields.io/badge/build-passing-green)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('src="https://img.shields.io/badge/build-passing-green"')
      expect(result.html).not.toContain('/api/registry/image-proxy')
    })

    it('does not proxy jsdelivr CDN images', async () => {
      const markdown = `![logo](./logo.png)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('src="https://cdn.jsdelivr.net/npm/test-pkg/logo.png"')
      expect(result.html).not.toContain('/api/registry/image-proxy')
    })
  })

  describe('untrusted domains (proxied)', () => {
    it('proxies images from unknown third-party domains with HMAC signature', async () => {
      const markdown = `![tracker](https://evil-tracker.com/pixel.gif)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('/api/registry/image-proxy?url=')
      expect(result.html).toContain(encodeURIComponent('https://evil-tracker.com/pixel.gif'))
      // HTML attributes encode & as &amp;
      expect(result.html).toMatch(/&amp;sig=[0-9a-f]{64}/)
      expect(result.html).not.toContain('src="https://evil-tracker.com/pixel.gif"')
    })

    it('proxies images from arbitrary hosts with HMAC signature', async () => {
      const markdown = `![img](https://some-random-host.com/image.png)`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('/api/registry/image-proxy?url=')
      expect(result.html).toContain(encodeURIComponent('https://some-random-host.com/image.png'))
      expect(result.html).toMatch(/&amp;sig=[0-9a-f]{64}/)
    })

    it('proxies HTML img tags from untrusted domains with HMAC signature', async () => {
      const markdown = `<img src="https://unknown-site.org/tracking.png" alt="test">`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toContain('/api/registry/image-proxy?url=')
      expect(result.html).toContain(encodeURIComponent('https://unknown-site.org/tracking.png'))
      expect(result.html).toMatch(/&amp;sig=[0-9a-f]{64}/)
    })
  })
})

describe('ReadmeResponse shape (HTML route contract)', () => {
  it('returns ReadmeResponse with html, mdExists, playgroundLinks, toc', async () => {
    const markdown = `# Title\n\nSome **bold** text.`
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result).toMatchObject({
      html: expect.any(String),
      mdExists: true,
      playgroundLinks: [],
      toc: expect.any(Array),
    })
    expect(result.html).toContain('Title')
    expect(result.html).toContain('bold')
  })

  it('returns empty-state shape when content is empty', async () => {
    const result = await renderReadmeHtml('', 'test-pkg')

    expect(result).toMatchObject({
      html: '',
      playgroundLinks: [],
      toc: [],
    })
    expect(result.playgroundLinks).toHaveLength(0)
    expect(result.toc).toHaveLength(0)
  })

  it('extracts toc from headings', async () => {
    const markdown = `# Install\n\n## CLI\n\n## API`
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]).toMatchObject({ text: 'Install', depth: 1 })
    expect(result.toc[1]).toMatchObject({ text: 'CLI', depth: 2 })
    expect(result.toc[2]).toMatchObject({ text: 'API', depth: 2 })
    expect(result.toc.every(t => t.id.startsWith('user-content-'))).toBe(true)
  })
})

// Tests for the lazy ATX heading extension, matching the behavior of
// markdown-it-lazy-headers (https://npmx.dev/package/markdown-it-lazy-headers).
describe('Lazy ATX headings (no space after #)', () => {
  it('parses #foo through ######foo as headings', async () => {
    const markdown = '#foo\n\n##foo\n\n###foo\n\n####foo\n\n#####foo\n\n######foo'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(6)
    expect(result.toc[0]).toMatchObject({ text: 'foo', depth: 1 })
    expect(result.toc[1]).toMatchObject({ text: 'foo', depth: 2 })
    expect(result.toc[2]).toMatchObject({ text: 'foo', depth: 3 })
    expect(result.toc[3]).toMatchObject({ text: 'foo', depth: 4 })
    expect(result.toc[4]).toMatchObject({ text: 'foo', depth: 5 })
    expect(result.toc[5]).toMatchObject({ text: 'foo', depth: 6 })
  })

  it('rejects 7+ # characters as not a heading', async () => {
    const markdown = '#######foo'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(0)
    expect(result.html).toContain('#######foo')
  })

  it('does not affect headings that already have spaces', async () => {
    const markdown = '# Title\n\n## Subtitle'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(2)
    expect(result.toc[0]).toMatchObject({ text: 'Title', depth: 1 })
    expect(result.toc[1]).toMatchObject({ text: 'Subtitle', depth: 2 })
  })

  it('strips optional trailing # sequence preceded by space', async () => {
    const markdown = '##foo ##'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]).toMatchObject({ text: 'foo', depth: 2 })
  })

  it('keeps trailing # not preceded by space as part of content', async () => {
    const markdown = '#foo#'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]).toMatchObject({ text: 'foo#', depth: 1 })
  })

  it('does not modify lines inside fenced code blocks', async () => {
    const markdown = '```\n#not-a-heading\n```'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(0)
    expect(result.html).toContain('#not-a-heading')
  })

  it('handles mixed headings with and without spaces', async () => {
    const markdown = '#Title\n\nSome text\n\n## Subtitle\n\n###Another'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]).toMatchObject({ text: 'Title', depth: 1 })
    expect(result.toc[1]).toMatchObject({ text: 'Subtitle', depth: 2 })
    expect(result.toc[2]).toMatchObject({ text: 'Another', depth: 3 })
  })

  it('allows 1-3 spaces indentation', async () => {
    const markdown = ' ###foo\n\n  ##foo\n\n   #foo'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]).toMatchObject({ text: 'foo', depth: 3 })
    expect(result.toc[1]).toMatchObject({ text: 'foo', depth: 2 })
    expect(result.toc[2]).toMatchObject({ text: 'foo', depth: 1 })
  })

  it('works after paragraphs separated by blank lines', async () => {
    const markdown = 'Foo bar\n\n#baz\n\nBar foo'
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]).toMatchObject({ text: 'baz', depth: 1 })
  })
})

describe('HTML output', () => {
  it('returns sanitized html', async () => {
    const markdown = `# Title\n\nSome **bold** text and a [link](https://example.com).`
    const result = await renderReadmeHtml(markdown, 'test-pkg')

    expect(result.html)
      .toBe(`<h3 id="user-content-title" data-level="1"><a href="#user-content-title">Title</a></h3>
<p>Some <strong>bold</strong> text and a <a href="https://example.com" rel="nofollow noreferrer noopener" target="_blank">link</a>.</p>
`)
  })

  it('adds id to raw HTML headings', async () => {
    const result = await renderReadmeHtml('<h1>Title</h1>', 'test-pkg')
    expect(result.html).toContain('id="user-content-title"')
    expect(result.toc).toHaveLength(1)
    expect(result.toc[0]).toMatchObject({ text: 'Title', depth: 1 })
  })

  it('adds id to HTML heading in multi-element token', async () => {
    const md = '<h1 align="center">My Package</h1>\n<p align="center">A description</p>'
    const result = await renderReadmeHtml(md, 'test-pkg')
    expect(result.toc).toHaveLength(1)
    expect(result.html).toContain('id="user-content-my-package"')
    expect(result.toc[0]).toMatchObject({ text: 'My Package', depth: 1 })
  })

  it('handles duplicate raw HTML heading slugs', async () => {
    const md = '<h2>API</h2>\n\n<h2>API</h2>'
    const result = await renderReadmeHtml(md, 'test-pkg')
    expect(result.html).toContain('id="user-content-api"')
    expect(result.html).toContain('id="user-content-api-1"')
  })

  it('preserves supported attributes on raw HTML headings', async () => {
    const md = '<h1 align="center">My Package</h1>'
    const result = await renderReadmeHtml(md, 'test-pkg')

    expect(result.html).toContain('id="user-content-my-package"')
    expect(result.html).toContain('align="center"')
  })

  it('preserves supported attributes on rewritten raw HTML anchors (renderer.html path)', async () => {
    const md = [
      '<div>',
      '  <a href="https://stackblitz.com/edit/my-demo" title="Open demo">Open in StackBlitz</a>',
      '</div>',
    ].join('\n')
    const result = await renderReadmeHtml(md, 'test-pkg')

    expect(result.html).toContain('href="https://stackblitz.com/edit/my-demo"')
    expect(result.html).toContain('title="Open demo"')
    expect(result.html).toContain('rel="nofollow noreferrer noopener"')
    expect(result.html).toContain('target="_blank"')
  })

  it('preserves title when it appears before href (renderer.html path)', async () => {
    const md = [
      '<div>',
      '  <a title="Open demo" href="https://stackblitz.com/edit/my-demo">Open in StackBlitz</a>',
      '</div>',
    ].join('\n')
    const result = await renderReadmeHtml(md, 'test-pkg')

    expect(result.html).toContain('title="Open demo"')
    expect(result.html).toContain('href="https://stackblitz.com/edit/my-demo"')
    expect(result.html).toContain('rel="nofollow noreferrer noopener"')
    expect(result.html).toContain('target="_blank"')
  })

  it('overrides existing rel and target instead of duplicating them (renderer.html path)', async () => {
    const md = [
      '<div>',
      '  <a href="https://stackblitz.com/edit/my-demo" rel="bookmark" target="_self" title="Open demo">Open in StackBlitz</a>',
      '</div>',
    ].join('\n')
    const result = await renderReadmeHtml(md, 'test-pkg')

    expect(result.html).toContain('rel="nofollow noreferrer noopener"')
    expect(result.html).toContain('target="_blank"')
    expect(result.html).not.toContain('rel="bookmark"')
    expect(result.html).not.toContain('target="_self"')
  })
})

/**
 * Tests for issue #1323: single-pass markdown rendering behavior.
 *
 * The core concern is that mixing markdown headings and raw HTML headings
 * must produce TOC entries, heading IDs, and duplicate-slug suffixes in
 * exact document order — the same as GitHub does.
 *
 * If the implementation processes markdown headings in one pass and HTML
 * headings in a separate (later) pass, the ordering will be wrong.
 */
describe('Issue #1323 — single-pass rendering correctness', () => {
  describe('mixed markdown + HTML headings: TOC order and IDs', () => {
    it('produces TOC entries in document order when markdown and HTML headings are interleaved', async () => {
      // This is the core scenario from the issue: HTML headings appear
      // between markdown headings. A two-pass approach would collect all
      // markdown headings first, then HTML headings — scrambling the order.
      const md = [
        '# First (markdown)',
        '',
        '<h2>Second (html)</h2>',
        '',
        '## Third (markdown)',
        '',
        '<h2>Fourth (html)</h2>',
        '',
        '## Fifth (markdown)',
      ].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      // TOC must reflect exact document order
      expect(result.toc).toHaveLength(5)
      expect(result.toc[0]!.text).toBe('First (markdown)')
      expect(result.toc[1]!.text).toBe('Second (html)')
      expect(result.toc[2]!.text).toBe('Third (markdown)')
      expect(result.toc[3]!.text).toBe('Fourth (html)')
      expect(result.toc[4]!.text).toBe('Fifth (markdown)')
    })

    it('assigns duplicate-slug suffixes in document order across mixed heading types', async () => {
      // Two markdown "API" headings with an HTML "API" heading in between.
      // Correct: api, api-1, api-2 in that order.
      // If HTML headings are processed in a separate pass, the HTML one
      // could get suffix -2 while the last markdown one gets -1.
      const md = ['## API', '', '<h2>API</h2>', '', '## API'].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      expect(result.toc).toHaveLength(3)
      expect(result.toc[0]!.id).toBe('user-content-api')
      expect(result.toc[1]!.id).toBe('user-content-api-1')
      expect(result.toc[2]!.id).toBe('user-content-api-2')

      // The HTML output must also have these IDs in order
      const ids = Array.from(result.html.matchAll(/id="(user-content-api(?:-\d+)?)"/g), m => m[1])
      expect(ids).toEqual(['user-content-api', 'user-content-api-1', 'user-content-api-2'])
    })

    it('does not collide when heading text already starts with user-content-', async () => {
      const md = ['# Title', '', '# user-content-title'].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      const ids = Array.from(result.html.matchAll(/id="(user-content-[^"]+)"/g), m => m[1])
      expect(ids).toEqual(['user-content-title', 'user-content-user-content-title'])
      expect(new Set(ids).size).toBe(ids.length)
      expect(result.toc.map(t => t.id)).toEqual(ids)
    })

    it('heading semantic levels are sequential even when mixing heading types', async () => {
      // h1 (md) → h3, h3 (html) → should be h4 (max = lastSemantic + 1),
      // not jump to h5 or h6 because it was processed in a later pass.
      const md = ['# Title', '', '<h3>Subsection</h3>', '', '#### Deep'].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      // Extract semantic tags in order from the HTML
      const tags = Array.from(result.html.matchAll(/<h(\d)/g), m => Number(m[1]))
      // h1→h3, h3→h4 (sequential after h3), h4→h5 (sequential after h4)
      expect(tags).toEqual([3, 4, 5])
    })
  })

  describe('HTML heading between markdown headings — ID and href consistency', () => {
    it('heading id and its anchor href point to the same slug', async () => {
      const md = ['# Introduction', '', '<h2>Getting Started</h2>', '', '## Installation'].join(
        '\n',
      )

      const result = await renderReadmeHtml(md, 'test-pkg')

      // For every heading, the slug used in id="user-content-{slug}" must
      // match the slug in the child anchor href="#user-content-{slug}"
      // (resolveUrl prefixes # anchors with user-content-).
      const headingPairs = [
        ...result.html.matchAll(/id="user-content-([^"]+)"[^>]*><a href="#user-content-([^"]+)">/g),
      ]
      expect(headingPairs.length).toBeGreaterThan(0)
      for (const match of headingPairs) {
        // slug portion must be identical
        expect(match[1]).toBe(match[2])
      }
    })
  })

  describe('playground links collected from HTML <a> tags in single pass', () => {
    it('collects playground links from raw HTML anchor tags', async () => {
      // Some READMEs (like eslint's sponsor section) use raw HTML <a> tags
      // instead of markdown link syntax. These must also be picked up.
      const md = [
        '# My Package',
        '',
        '<a href="https://stackblitz.com/edit/my-demo">Open in StackBlitz</a>',
        '',
        'Some text with a [CodeSandbox link](https://codesandbox.io/s/example)',
      ].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      // Both playground links should be collected regardless of syntax
      const providers = result.playgroundLinks.map(l => l.provider)
      expect(providers).toContain('stackblitz')
      expect(providers).toContain('codesandbox')
    })
  })

  describe('complex real-world interleaving (atproxy-like)', () => {
    it('handles a README with HTML h1 followed by markdown h2 and mixed content', async () => {
      // Simulates a pattern like atproxy's README where h1 is HTML
      // and subsequent headings are markdown
      const md = [
        '<h1 align="center">atproxy</h1>',
        '<p align="center">A cool proxy library</p>',
        '',
        '## Features',
        '',
        '- Fast',
        '- Simple',
        '',
        '## Installation',
        '',
        '```bash',
        'npm install atproxy',
        '```',
        '',
        '<h2>Advanced Usage</h2>',
        '',
        '## API',
        '',
        '### Methods',
      ].join('\n')

      const result = await renderReadmeHtml(md, 'test-pkg')

      // TOC order must be: atproxy, Features, Installation, Advanced Usage, API, Methods
      expect(result.toc.map(t => t.text)).toEqual([
        'atproxy',
        'Features',
        'Installation',
        'Advanced Usage',
        'API',
        'Methods',
      ])

      // All IDs should be unique
      const ids = result.toc.map(t => t.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })
})
