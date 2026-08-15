import type { MarkdownRepoInfo } from '~~/server/utils/changelog/markdown'
import { describe, expect, it, vi, beforeAll } from 'vitest'
import { createGithubRepoInfo, createGitLabRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'

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
  return createGithubRepoInfo('test-owner', 'test-repo')
}

function changelogMdInfoWithPath() {
  return createGithubRepoInfo('test-owner', 'test-repo', 'packages/test/changelog.md')
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

describe('Turn plaintext #isssue/#pr, !pr, @account & commmit into links', () => {
  describe('ATX heading #issue/#pr exemption & turn into links', () => {
    it("shouldn't turn issues/PRs into headings but into links", async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `#2869 hello
  
  #2717 world`

      const result = renderer(markdown)
      expect(result.html).toBe(
        '<p><a href="https://github.com/test-owner/test-repo/issues/2869" rel="nofollow noreferrer noopener" target="_blank">#2869</a> hello</p>\n<p>  <a href="https://github.com/test-owner/test-repo/issues/2717" rel="nofollow noreferrer noopener" target="_blank">#2717</a> world</p>\n',
      )
    })

    it("shouldn't turn issues/PRs in list into headings but into links", async () => {
      const info = changelogMdinfo()
      const renderer = await changelogRenderer(info)
      const markdown = `- #2869 hello
- #2717 world`

      const result = renderer(markdown)
      expect(result.html).toBe(
        '<ul>\n<li><a href="https://github.com/test-owner/test-repo/issues/2869" rel="nofollow noreferrer noopener" target="_blank">#2869</a> hello</li>\n<li><a href="https://github.com/test-owner/test-repo/issues/2717" rel="nofollow noreferrer noopener" target="_blank">#2717</a> world</li>\n</ul>\n',
      )
    })
  })

  it('should turn issue/pr & account into links', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    // text from date-fns v4.3.0
    const markdown = `- Fixed pt locale first day of week to be Sunday. See #4195 by @ImRodry.
- Fixed zh-CN, zh-HK, and zh-TW locale month parsing for October, November, and December. See #4194 by @puneetdixit200.
`
    const result = renderer(markdown)

    expect(result.html).toBe(`<ul>
<li>Fixed pt locale first day of week to be Sunday. See <a href="https://github.com/test-owner/test-repo/issues/4195" rel="nofollow noreferrer noopener" target="_blank">#4195</a> by <a href="https://github.com/ImRodry" rel="nofollow noreferrer noopener" target="_blank">@ImRodry</a>.</li>
<li>Fixed zh-CN, zh-HK, and zh-TW locale month parsing for October, November, and December. See <a href="https://github.com/test-owner/test-repo/issues/4194" rel="nofollow noreferrer noopener" target="_blank">#4194</a> by <a href="https://github.com/puneetdixit200" rel="nofollow noreferrer noopener" target="_blank">@puneetdixit200</a>.</li>
</ul>
`)
  })

  it('should turn issue/pr into links between ()', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    // text comes from npmx release 0.15.0
    const markdown = `- Minor ui improvements (#2834)
- deps: Update module-replacements (#2838)
- Release v0.15.0 (#2835)`

    const result = renderer(markdown)

    expect(result.html).toBe(`<ul>
<li>Minor ui improvements (<a href="https://github.com/test-owner/test-repo/issues/2834" rel="nofollow noreferrer noopener" target="_blank">#2834</a>)</li>
<li>deps: Update module-replacements (<a href="https://github.com/test-owner/test-repo/issues/2838" rel="nofollow noreferrer noopener" target="_blank">#2838</a>)</li>
<li>Release v0.15.0 (<a href="https://github.com/test-owner/test-repo/issues/2835" rel="nofollow noreferrer noopener" target="_blank">#2835</a>)</li>
</ul>
`)
  })

  it('should turn mutliple issue/pr after each other issues/pr into links', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    // test from fullcalendar v6.1.18
    const markdown = 'fix: Optimize custom content-injection rerendering performance (#3003, #7650)'

    const result = renderer(markdown)

    expect(result.html).toBe(
      `<p>fix: Optimize custom content-injection rerendering performance (<a href="https://github.com/test-owner/test-repo/issues/3003" rel="nofollow noreferrer noopener" target="_blank">#3003</a>, <a href="https://github.com/test-owner/test-repo/issues/7650" rel="nofollow noreferrer noopener" target="_blank">#7650</a>)</p>\n`,
    )
  })

  it('should turn accounts into lists', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    // from npmx release 0.13.0, wanted to a release with many accounts mentioned
    const markdown = `### ❤️ Contributors\n\n- Daniel Roe (@danielroe)\n- Alex Savelyev (@alexdln)\n- Alec Lloyd Probert (@graphieros)\n- cylewaitforit (@cylewaitforit)\n- Vinayak (@VinayakMaharaj)\n- Robin de Vos (@Codefoxdev)\n- Patrick Dewey (@ptdewey)\n- Dominik Dorfmeister 🔮 (@TkDodo)\n- Philippe Serhal (@serhalp)\n- Wilco (@WilcoSp)\n- Willow (GHOST) (@ghostdevv)\n- Aryan Pingle (@aryanpingle)\n- Roman (@gameroman)\n- Matteo Gabriele (@MatteoGabriele)\n- Alberto Rico (@alrico88)\n- TAKAHASHI Shuuji (@shuuji3)\n- Bugo (@dragomano)\n- Sasha (@Sasha125588)\n- Iestyn (@IestynGage)\n- Torben Haack (@t128n)\n- Mutsumi (@BabyLy233)\n- Bonsak Schiledrop (@bonsak)\n`

    const result = renderer(markdown)

    expect(result.html)
      .toBe(`<h2 id="user-content-contributors" data-level="3"><a href="#user-content-contributors">❤️ Contributors</a></h2>
<ul>
<li>Daniel Roe (<a href="https://github.com/danielroe" rel="nofollow noreferrer noopener" target="_blank">@danielroe</a>)</li>
<li>Alex Savelyev (<a href="https://github.com/alexdln" rel="nofollow noreferrer noopener" target="_blank">@alexdln</a>)</li>
<li>Alec Lloyd Probert (<a href="https://github.com/graphieros" rel="nofollow noreferrer noopener" target="_blank">@graphieros</a>)</li>
<li>cylewaitforit (<a href="https://github.com/cylewaitforit" rel="nofollow noreferrer noopener" target="_blank">@cylewaitforit</a>)</li>
<li>Vinayak (<a href="https://github.com/VinayakMaharaj" rel="nofollow noreferrer noopener" target="_blank">@VinayakMaharaj</a>)</li>
<li>Robin de Vos (<a href="https://github.com/Codefoxdev" rel="nofollow noreferrer noopener" target="_blank">@Codefoxdev</a>)</li>
<li>Patrick Dewey (<a href="https://github.com/ptdewey" rel="nofollow noreferrer noopener" target="_blank">@ptdewey</a>)</li>
<li>Dominik Dorfmeister 🔮 (<a href="https://github.com/TkDodo" rel="nofollow noreferrer noopener" target="_blank">@TkDodo</a>)</li>
<li>Philippe Serhal (<a href="https://github.com/serhalp" rel="nofollow noreferrer noopener" target="_blank">@serhalp</a>)</li>
<li>Wilco (<a href="https://github.com/WilcoSp" rel="nofollow noreferrer noopener" target="_blank">@WilcoSp</a>)</li>
<li>Willow (GHOST) (<a href="https://github.com/ghostdevv" rel="nofollow noreferrer noopener" target="_blank">@ghostdevv</a>)</li>
<li>Aryan Pingle (<a href="https://github.com/aryanpingle" rel="nofollow noreferrer noopener" target="_blank">@aryanpingle</a>)</li>
<li>Roman (<a href="https://github.com/gameroman" rel="nofollow noreferrer noopener" target="_blank">@gameroman</a>)</li>
<li>Matteo Gabriele (<a href="https://github.com/MatteoGabriele" rel="nofollow noreferrer noopener" target="_blank">@MatteoGabriele</a>)</li>
<li>Alberto Rico (<a href="https://github.com/alrico88" rel="nofollow noreferrer noopener" target="_blank">@alrico88</a>)</li>
<li>TAKAHASHI Shuuji (<a href="https://github.com/shuuji3" rel="nofollow noreferrer noopener" target="_blank">@shuuji3</a>)</li>
<li>Bugo (<a href="https://github.com/dragomano" rel="nofollow noreferrer noopener" target="_blank">@dragomano</a>)</li>
<li>Sasha (<a href="https://github.com/Sasha125588" rel="nofollow noreferrer noopener" target="_blank">@Sasha125588</a>)</li>
<li>Iestyn (<a href="https://github.com/IestynGage" rel="nofollow noreferrer noopener" target="_blank">@IestynGage</a>)</li>
<li>Torben Haack (<a href="https://github.com/t128n" rel="nofollow noreferrer noopener" target="_blank">@t128n</a>)</li>
<li>Mutsumi (<a href="https://github.com/BabyLy233" rel="nofollow noreferrer noopener" target="_blank">@BabyLy233</a>)</li>
<li>Bonsak Schiledrop (<a href="https://github.com/bonsak" rel="nofollow noreferrer noopener" target="_blank">@bonsak</a>)</li>
</ul>
`)
  })

  it('should not turn @org/package into account link', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)

    const markdown = `- Bump @tiptap/y-tiptap to version ^3.0.5\n- @tiptap/core@3.26.1\n  - @tiptap/pm@3.26.1`

    const result = renderer(markdown)

    expect(result.html).toBe(`<ul>
<li>Bump @tiptap/y-tiptap to version ^3.0.5</li>
<li>@tiptap/core@3.26.1<ul>
<li>@tiptap/pm@3.26.1</li>
</ul>
</li>
</ul>
`)
  })

  it('should turn commits into links', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    // from tiptap 3.27.1, 3.27.0, 3.26.0 & npmx 0.14.0 & 0.14.1
    const markdown = `- a16901d: Fix ordered list parsing so under-indented continuation lines preserve their first character
- Updated dependencies [6270b99]
- 7fb19eb: Only add hash attributes to nodes, not to marks.
- Release v0.14.0 36128a54
- Empty (4cab893c)`

    const result = renderer(markdown)

    expect(result.html).toBe(`<ul>
<li><a href="https://github.com/test-owner/test-repo/commit/a16901d" rel="nofollow noreferrer noopener" target="_blank">a16901d</a>: Fix ordered list parsing so under-indented continuation lines preserve their first character</li>
<li>Updated dependencies [<a href="https://github.com/test-owner/test-repo/commit/6270b99" rel="nofollow noreferrer noopener" target="_blank">6270b99</a>]</li>
<li><a href="https://github.com/test-owner/test-repo/commit/7fb19eb" rel="nofollow noreferrer noopener" target="_blank">7fb19eb</a>: Only add hash attributes to nodes, not to marks.</li>
<li>Release v0.14.0 <a href="https://github.com/test-owner/test-repo/commit/36128a54" rel="nofollow noreferrer noopener" target="_blank">36128a5</a></li>
<li>Empty (<a href="https://github.com/test-owner/test-repo/commit/4cab893c" rel="nofollow noreferrer noopener" target="_blank">4cab893</a>)</li>
</ul>
`)
  })

  it('should not format an issue/pr into a commit', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)

    const markdown = `lorem ipsum is fixed in #1234567`

    const result = renderer(markdown)

    expect(result.html).toBe(
      `<p>lorem ipsum is fixed in <a href="https://github.com/test-owner/test-repo/issues/1234567" rel="nofollow noreferrer noopener" target="_blank">#1234567</a></p>\n`,
    )
  })

  it('should format gitlab merge requests', async () => {
    const info = createGitLabRepoInfo('gitlab.com', 'test', 'test')
    const renderer = await changelogRenderer(info)

    const markdown = `!123 hallo\n\nhttps://gitlab.com/test/test/-/merge_requests/321 world`
    const result = renderer(markdown)

    expect(result.html).toBe(
      `<p><a href="https://gitlab.com/test/test/-/merge_requests/123" rel="nofollow noreferrer noopener" target="_blank">!123</a> hallo</p>
<p><a href="https://gitlab.com/test/test/-/merge_requests/321" rel="nofollow noreferrer noopener" target="_blank">!321</a> world</p>
`,
    )
  })

  it('should format at proto @account handle but not @version', async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)

    const markdown = `nppmx @npmx.dev\n\n3po @3po.at.proto\n\nlorem @1.2.3 ipsum`
    const result = renderer(markdown)

    expect(result.html).toBe(
      `<p>nppmx <a href="https://github.com/npmx.dev" rel="nofollow noreferrer noopener" target="_blank">@npmx.dev</a></p>
<p>3po <a href="https://github.com/3po.at.proto" rel="nofollow noreferrer noopener" target="_blank">@3po.at.proto</a></p>
<p>lorem @1.2.3 ipsum</p>
`,
    )
  })

  it("shouldn't format package@version", async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    const markdown = `install package with package@latest or specific version like package@1.2.3`

    const result = renderer(markdown)
    expect(result.html).toBe(
      `<p>install package with package@latest or specific version like package@1.2.3</p>
`,
    )
  })

  it("shouldn't format email as git link", async () => {
    const info = changelogMdinfo()
    const renderer = await changelogRenderer(info)
    const markdown = `email to test@package.test to get in contact`

    const result = renderer(markdown)
    expect(result.html).toBe(
      `<p>email to <a href="mailto:test@package.test" rel="nofollow noreferrer noopener" target="_blank">test@package.test</a> to get in contact</p>
`,
    )
  })
})

describe('format unformatted/auto links to git', () => {
  // links to account won't be formatted, this is something also git providers don't do
  it('should turn issue, pr, commit & compare links to formatted links', async () => {
    const info = createGithubRepoInfo('vueuse', 'vueuse')
    const renderer = await changelogRenderer(info)
    // from vueuse 14.3.0 (last 2 links changed from `issues` -> `pull`)
    const markdown = `- Expose pointer event onLongPress  -  by mrcwbr in https://github.com/vueuse/vueuse/issues/5295 https://github.com/vueuse/vueuse/commit/b1688bd2
- createInjectionState: Non-undefined return when default specified  -  by Laupetin in https://github.com/vueuse/vueuse/issues/5306 https://github.com/vueuse/vueuse/commit/b0c51c27
- createReusableTemplate: Add support for specifying component names  -  by wbolster in https://github.com/vueuse/vueuse/pull/5300 https://github.com/vueuse/vueuse/commit/ea29d5cb
- nuxt: Add composable variants to auto imports  -  by OrbisK in https://github.com/vueuse/vueuse/issues/5285 https://github.com/vueuse/vueuse/commit/ac2ef95d

https://github.com/vueuse/vueuse/compare/v14.2.1...v14.3.0`

    const result = renderer(markdown)
    expect(result.html).toBe(`<ul>
<li>Expose pointer event onLongPress  -  by mrcwbr in <a href="https://github.com/vueuse/vueuse/issues/5295" rel="nofollow noreferrer noopener" target="_blank">#5295</a> <a href="https://github.com/vueuse/vueuse/commit/b1688bd2" rel="nofollow noreferrer noopener" target="_blank">b1688bd</a></li>
<li>createInjectionState: Non-undefined return when default specified  -  by Laupetin in <a href="https://github.com/vueuse/vueuse/issues/5306" rel="nofollow noreferrer noopener" target="_blank">#5306</a> <a href="https://github.com/vueuse/vueuse/commit/b0c51c27" rel="nofollow noreferrer noopener" target="_blank">b0c51c2</a></li>
<li>createReusableTemplate: Add support for specifying component names  -  by wbolster in <a href="https://github.com/vueuse/vueuse/pull/5300" rel="nofollow noreferrer noopener" target="_blank">#5300</a> <a href="https://github.com/vueuse/vueuse/commit/ea29d5cb" rel="nofollow noreferrer noopener" target="_blank">ea29d5c</a></li>
<li>nuxt: Add composable variants to auto imports  -  by OrbisK in <a href="https://github.com/vueuse/vueuse/issues/5285" rel="nofollow noreferrer noopener" target="_blank">#5285</a> <a href="https://github.com/vueuse/vueuse/commit/ac2ef95d" rel="nofollow noreferrer noopener" target="_blank">ac2ef95</a></li>
</ul>
<p><a href="https://github.com/vueuse/vueuse/compare/v14.2.1...v14.3.0" rel="nofollow noreferrer noopener" target="_blank">v14.2.1...v14.3.0</a></p>
`)
  })

  it('should ignore formatted links', async () => {
    const info = createGithubRepoInfo('vueuse', 'vueuse')
    const renderer = await changelogRenderer(info)

    const markdown = `- Expose pointer event onLongPress  -  by mrcwbr in https://github.com/vueuse/vueuse/issues/5295 https://github.com/vueuse/vueuse/commit/b1688bd2
- createInjectionState: Non-undefined return when default specified  -  by Laupetin in [!5306](https://github.com/vueuse/vueuse/issues/5306) [<samp>(b0c51)</samp>](https://github.com/vueuse/vueuse/commit/b0c51c27)
- createReusableTemplate: Add support for specifying component names  -  by wbolster in https://github.com/vueuse/vueuse/pull/5300 https://github.com/vueuse/vueuse/commit/ea29d5cb
- nuxt: Add composable variants to auto imports  -  by OrbisK in [$5285](https://github.com/vueuse/vueuse/issues/5285) [<samp>(ac2ef)</samp>](https://github.com/vueuse/vueuse/commit/ac2ef95d)

[View changes on GitHub](https://github.com/vueuse/vueuse/compare/v14.2.1...v14.3.0)`
    const result = renderer(markdown)
    expect(result.html).toBe(`<ul>
<li>Expose pointer event onLongPress  -  by mrcwbr in <a href="https://github.com/vueuse/vueuse/issues/5295" rel="nofollow noreferrer noopener" target="_blank">#5295</a> <a href="https://github.com/vueuse/vueuse/commit/b1688bd2" rel="nofollow noreferrer noopener" target="_blank">b1688bd</a></li>
<li>createInjectionState: Non-undefined return when default specified  -  by Laupetin in <a href="https://github.com/vueuse/vueuse/issues/5306" rel="nofollow noreferrer noopener" target="_blank">!5306</a> <a href="https://github.com/vueuse/vueuse/commit/b0c51c27" rel="nofollow noreferrer noopener" target="_blank">(b0c51)</a></li>
<li>createReusableTemplate: Add support for specifying component names  -  by wbolster in <a href="https://github.com/vueuse/vueuse/pull/5300" rel="nofollow noreferrer noopener" target="_blank">#5300</a> <a href="https://github.com/vueuse/vueuse/commit/ea29d5cb" rel="nofollow noreferrer noopener" target="_blank">ea29d5c</a></li>
<li>nuxt: Add composable variants to auto imports  -  by OrbisK in <a href="https://github.com/vueuse/vueuse/issues/5285" rel="nofollow noreferrer noopener" target="_blank">$5285</a> <a href="https://github.com/vueuse/vueuse/commit/ac2ef95d" rel="nofollow noreferrer noopener" target="_blank">(ac2ef)</a></li>
</ul>
<p><a href="https://github.com/vueuse/vueuse/compare/v14.2.1...v14.3.0" rel="nofollow noreferrer noopener" target="_blank">View changes on GitHub</a></p>
`)
  })
})
