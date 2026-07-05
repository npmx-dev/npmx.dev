import type { MarkdownRepoInfo } from '~~/server/utils/changelog/markdown'
import { describe, expect, it, vi, beforeAll } from 'vitest'

// testing changelog specific needs, others things are tested at ../readme.spec.ts

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

const { changelogRenderer } = await import('#server/utils/changelog/markdown')

function changelogMdinfo(): MarkdownRepoInfo {
  return {
    blobBaseUrl: `https://github.com/test-owner/test-repo/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/test-owner/test-repo/HEAD`,
  }
}

function changelogMdInfoWithPath() {
  return {
    blobBaseUrl: `https://github.com/test-owner/test-repo/blob/HEAD`,
    rawBaseUrl: `https://raw.githubusercontent.com/test-owner/test-repo/HEAD`,
    path: 'packages/test/changelog.md',
  }
}

describe('URL Resolution', () => {
  describe('resolves from /markdown.md & releases', () => {
    it('resolves relative .md links to blob URL for rendered viewing', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        `href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md"`,
      )
    })

    it('resolves without ./ or / .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Guide](GUIDE.MD)`
      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/GUIDE.MD"',
      )
    })

    it('resolves absolute .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Security](/SECURITY.MD)`

      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/SECURITY.MD"',
      )
    })

    it('resolves nested relative .md links to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[API Docs](./docs/api/reference.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/docs/api/reference.md"',
      )
    })

    it('resolves relative .md links with query strings to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[FAQ](./FAQ.md?ref=main)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/FAQ.md?ref=main"',
      )
    })

    it('resolves relative .md links with anchors to blob URL', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Install Section](./CONTRIBUTING.md#installation)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/CONTRIBUTING.md#installation"',
      )
    })

    it('resolves non-.md files to raw URL (not blob)', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Image](./assets/logo.png)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/assets/logo.png"',
      )
    })

    it('resolves to the root when going to far back', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[License](../../../LICENSE)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/LICENSE"',
      )
    })
  })

  describe('resolves from a deeper changelog.md', () => {
    it('resolves relative .md links to blob URL for rendered viewing', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Contributing](./CONTRIBUTING.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        `href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/CONTRIBUTING.md"`,
      )
    })

    it('resolves without ./ or / .md links to a relative blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Guide](GUIDE.MD)`
      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/GUIDE.MD"',
      )
    })

    it('resolves absolute .md links to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Security](/SECURITY.MD)`

      const result = renderer(markdown)
      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/SECURITY.MD"',
      )
    })

    it('resolves nested relative .md links to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[API Docs](./docs/api/reference.md)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/docs/api/reference.md"',
      )
    })

    it('resolves relative .md links with query strings to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[FAQ](./FAQ.md?ref=main)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/FAQ.md?ref=main"',
      )
    })

    it('resolves relative .md links with anchors to blob URL', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Install Section](./CONTRIBUTING.md#installation)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://github.com/test-owner/test-repo/blob/HEAD/packages/test/CONTRIBUTING.md#installation"',
      )
    })

    it('resolves non-.md files to raw URL (not blob)', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[Image](./assets/logo.png)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/packages/test/assets/logo.png"',
      )
    })

    it('resolves to the root when going to far back', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[License](../../../LICENSE)`
      const result = renderer(markdown)

      expect(result.html).toContain(
        'href="https://raw.githubusercontent.com/test-owner/test-repo/HEAD/LICENSE"',
      )
    })
  })

  describe('resolves full urls', () => {
    it('leaves absolute .md URLs unchanged', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `[External Guide](https://example.com/guide.md)`
      const result = renderer(markdown)
      expect(result.html).toContain('href="https://example.com/guide.md"')
    })

    it('leaves absolute non-.md URLs unchanged', async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `[Docs](https://docs.example.com/)`
      const result = renderer(markdown)
      expect(result.html).toContain('href="https://docs.example.com/"')
    })
  })

  describe('anchor links', () => {
    describe('for changelog.md', () => {
      it('prefixes anchor links with user-content-', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)

        const markdown = `[Jump to section](#installation)`
        const result = renderer(markdown)

        expect(result.html).toContain('href="#user-content-installation"')
      })

      it('normalizes mixed-case heading fragments to lowercase slugs', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)
        const markdown = `[Associations section](#Associations)`
        const result = renderer(markdown)

        expect(result.html).toContain('href="#user-content-associations"')
      })
    })

    describe('for releases', () => {
      it('prefixes anchor links with user-content-', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)

        const markdown = `[Jump to section](#installation)`
        const result = renderer(markdown, '123456789')

        expect(result.html).toContain('href="#user-content-123456789-installation"')
      })

      it('normalizes mixed-case heading fragments to lowercase slugs', async () => {
        const info = changelogMdinfo()
        const renderer = await changelogRenderer(info)
        const markdown = `[Associations section](#Associations)`
        const result = renderer(markdown, 123456789)

        expect(result.html).toContain('href="#user-content-123456789-associations"')
      })
    })
  })

  describe('npm.js urls', () => {
    it('redirects npmjs.com urls to local', async () => {
      const markdown = `[Some npmjs.com link](https://www.npmjs.com/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.com urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.com link](http://npmjs.com/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('does not redirect npmjs.com to local if they are in the list of exceptions', async () => {
      const markdown = `[Root Contributing](https://www.npmjs.com/products)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="https://www.npmjs.com/products"')
    })

    it('redirects npmjs.org urls to local', async () => {
      const markdown = `[Some npmjs.org link](https://www.npmjs.org/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })

    it('redirects npmjs.org urls to local (no www and http)', async () => {
      const markdown = `[Some npmjs.org link](http://npmjs.org/package/test-pkg)`
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const result = renderer(markdown)

      expect(result.html).toContain('href="/package/test-pkg"')
    })
  })
})

describe('Heading & toc resolution', () => {
  describe('for markdown.md headings', () => {
    it('should resolve heading starting from h2 & return to h3 at depth 2 correctly', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `# Vue
##v3
###v3.5
#### v3.5.33
##### Features
###### Notes
##v2
###v2.7
#### v2.7.15
##### Bug fixes
###### Notes`
      const result = renderer(markdown)

      expect(result.html)
        .toBe(`<h2 id="user-content-vue" data-level="1"><a href="#user-content-vue">Vue</a></h2>
<h3 id="user-content-v3" data-level="2"><a href="#user-content-v3">v3</a></h3>
<h4 id="user-content-v35" data-level="3"><a href="#user-content-v35">v3.5</a></h4>
<h5 id="user-content-v3533" data-level="4"><a href="#user-content-v3533">v3.5.33</a></h5>
<h6 id="user-content-features" data-level="5"><a href="#user-content-features">Features</a></h6>
<h6 id="user-content-notes" data-level="6"><a href="#user-content-notes">Notes</a></h6>
<h3 id="user-content-v2" data-level="2"><a href="#user-content-v2">v2</a></h3>
<h4 id="user-content-v27" data-level="3"><a href="#user-content-v27">v2.7</a></h4>
<h5 id="user-content-v2715" data-level="4"><a href="#user-content-v2715">v2.7.15</a></h5>
<h6 id="user-content-bug-fixes" data-level="5"><a href="#user-content-bug-fixes">Bug fixes</a></h6>
<h6 id="user-content-notes-1" data-level="6"><a href="#user-content-notes-1">Notes</a></h6>
`)
      expect(result.toc).toEqual([
        {
          depth: 1,
          id: 'user-content-vue',
          text: 'Vue',
        },
        {
          depth: 2,
          id: 'user-content-v3',
          text: 'v3',
        },
        {
          depth: 3,
          id: 'user-content-v35',
          text: 'v3.5',
        },
        {
          depth: 4,
          id: 'user-content-v3533',
          text: 'v3.5.33',
        },
        {
          depth: 5,
          id: 'user-content-features',
          text: 'Features',
        },
        {
          depth: 6,
          id: 'user-content-notes',
          text: 'Notes',
        },
        {
          depth: 2,
          id: 'user-content-v2',
          text: 'v2',
        },
        {
          depth: 3,
          id: 'user-content-v27',
          text: 'v2.7',
        },
        {
          depth: 4,
          id: 'user-content-v2715',
          text: 'v2.7.15',
        },
        {
          depth: 5,
          id: 'user-content-bug-fixes',
          text: 'Bug fixes',
        },
        {
          depth: 6,
          id: 'user-content-notes-1',
          text: 'Notes',
        },
      ])
    })
  })

  describe('for releases headings', () => {
    it('should resolve heading starting from h3 & return to h4 at depth 2 correctly', async () => {
      const info = changelogMdInfoWithPath()
      const renderer = await changelogRenderer(info)
      const markdown = `# Vue
##v3
###v3.5
#### v3.5.33
##### Features
###### Notes
##v2
###v2.7
#### v2.7.15
##### Bug fixes
###### Notes`
      const result = renderer(markdown, 123456789)

      expect(result.html)
        .toBe(`<h3 id="user-content-123456789-vue" data-level="1"><a href="#user-content-123456789-vue">Vue</a></h3>
<h4 id="user-content-123456789-v3" data-level="2"><a href="#user-content-123456789-v3">v3</a></h4>
<h5 id="user-content-123456789-v35" data-level="3"><a href="#user-content-123456789-v35">v3.5</a></h5>
<h6 id="user-content-123456789-v3533" data-level="4"><a href="#user-content-123456789-v3533">v3.5.33</a></h6>
<h6 id="user-content-123456789-features" data-level="5"><a href="#user-content-123456789-features">Features</a></h6>
<h6 id="user-content-123456789-notes" data-level="6"><a href="#user-content-123456789-notes">Notes</a></h6>
<h4 id="user-content-123456789-v2" data-level="2"><a href="#user-content-123456789-v2">v2</a></h4>
<h5 id="user-content-123456789-v27" data-level="3"><a href="#user-content-123456789-v27">v2.7</a></h5>
<h6 id="user-content-123456789-v2715" data-level="4"><a href="#user-content-123456789-v2715">v2.7.15</a></h6>
<h6 id="user-content-123456789-bug-fixes" data-level="5"><a href="#user-content-123456789-bug-fixes">Bug fixes</a></h6>
<h6 id="user-content-123456789-notes-1" data-level="6"><a href="#user-content-123456789-notes-1">Notes</a></h6>
`)
      expect(result.toc).toEqual([
        {
          depth: 1,
          id: 'user-content-123456789-vue',
          text: 'Vue',
        },
        {
          depth: 2,
          id: 'user-content-123456789-v3',
          text: 'v3',
        },
        {
          depth: 3,
          id: 'user-content-123456789-v35',
          text: 'v3.5',
        },
        {
          depth: 4,
          id: 'user-content-123456789-v3533',
          text: 'v3.5.33',
        },
        {
          depth: 5,
          id: 'user-content-123456789-features',
          text: 'Features',
        },
        {
          depth: 6,
          id: 'user-content-123456789-notes',
          text: 'Notes',
        },
        {
          depth: 2,
          id: 'user-content-123456789-v2',
          text: 'v2',
        },
        {
          depth: 3,
          id: 'user-content-123456789-v27',
          text: 'v2.7',
        },
        {
          depth: 4,
          id: 'user-content-123456789-v2715',
          text: 'v2.7.15',
        },
        {
          depth: 5,
          id: 'user-content-123456789-bug-fixes',
          text: 'Bug fixes',
        },
        {
          depth: 6,
          id: 'user-content-123456789-notes-1',
          text: 'Notes',
        },
      ])
    })
  })

  it("shouldn't resolve package@version to an email", async () => {
    const info = changelogMdInfoWithPath()
    const renderer = await changelogRenderer(info)
    const markdown = '## test-pkg@1.0.0'
    const result = renderer(markdown)

    expect(result.html).toBe(
      '<h2 id="user-content-test-pkg100" data-level="2"><a href="#user-content-test-pkg100">test-pkg@1.0.0</a></h2>\n',
    )
  })
})

describe('ATX heading #issue/#pr exemption', () => {
  it("shouldn't turn issues/PRs into headings", async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    const markdown = `#2869 hello

#2717 world`

    const result = renderer(markdown)
    expect(result.html).toBe('<p>#2869 hello</p>\n<p>#2717 world</p>\n')
  })

  it("shouldn't turn issues/PRs in list into headings", async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    const markdown = `- #2869 hello
- #2717 world`

    const result = renderer(markdown)
    expect(result.html).toBe('<ul>\n<li>#2869 hello</li>\n<li>#2717 world</li>\n</ul>\n')
  })
})
