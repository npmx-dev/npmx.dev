import type { RepositoryInfo } from '#shared/utils/git-providers'
import { describe, expect, it, vi, beforeAll } from 'vitest'

// Mock the global Nuxt auto-import before importing the module
beforeAll(() => {
  vi.stubGlobal(
    'getShikiHighlighter',
    vi.fn().mockResolvedValue({
      getLoadedLanguages: () => [],
      codeToHtml: (code: string) => `<pre><code>${code}</code></pre>`,
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
})

describe('Markdown Content Extraction', () => {
  describe('Markdown', () => {
    it('returns original markdown content unchanged', async () => {
      const markdown = `# Title\n\nSome **bold** text and a [link](https://example.com).`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.md).toBe(markdown)
    })
  })
  describe('HTML', () => {
    it('returns sanitized html', async () => {
      const markdown = `# Title\n\nSome **bold** text and a [link](https://example.com).`
      const result = await renderReadmeHtml(markdown, 'test-pkg')

      expect(result.html).toBe(`<h3 id="user-content-title" data-level="1">Title</h3>
<p>Some <strong>bold</strong> text and a <a href="https://example.com" rel="nofollow noreferrer noopener" target="_blank">link</a>.</p>
`)
    })
  })
})
