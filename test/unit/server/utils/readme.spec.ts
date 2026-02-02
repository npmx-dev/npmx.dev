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
