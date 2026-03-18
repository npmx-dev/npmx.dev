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
})
