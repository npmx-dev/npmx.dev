import { describe, expect, it, vi } from 'vitest'
import type { JsDelivrFileNode, LlmsTxtResult } from '../../../../shared/types'
import {
  discoverAgentFiles,
  fetchAgentFiles,
  generateLlmsTxt,
  generateRootLlmsTxt,
} from '../../../../server/utils/llm-docs'

describe('discoverAgentFiles', () => {
  it('discovers root-level agent files', () => {
    const files: JsDelivrFileNode[] = [
      { type: 'file', name: 'CLAUDE.md', size: 100 },
      { type: 'file', name: 'AGENTS.md', size: 200 },
      { type: 'file', name: 'AGENT.md', size: 50 },
      { type: 'file', name: '.cursorrules', size: 80 },
      { type: 'file', name: '.windsurfrules', size: 60 },
      { type: 'file', name: '.clinerules', size: 40 },
      { type: 'file', name: 'package.json', size: 500 },
      { type: 'file', name: 'README.md', size: 3000 },
    ]

    const result = discoverAgentFiles(files)

    expect(result).toContain('CLAUDE.md')
    expect(result).toContain('AGENTS.md')
    expect(result).toContain('AGENT.md')
    expect(result).toContain('.cursorrules')
    expect(result).toContain('.windsurfrules')
    expect(result).toContain('.clinerules')
    expect(result).not.toContain('package.json')
    expect(result).not.toContain('README.md')
    expect(result).toHaveLength(6)
  })

  it('discovers .github/copilot-instructions.md', () => {
    const files: JsDelivrFileNode[] = [
      {
        type: 'directory',
        name: '.github',
        files: [
          { type: 'file', name: 'copilot-instructions.md', size: 150 },
          { type: 'file', name: 'FUNDING.yml', size: 30 },
        ],
      },
    ]

    const result = discoverAgentFiles(files)

    expect(result).toEqual(['.github/copilot-instructions.md'])
  })

  it('discovers .cursor/rules/*.md files', () => {
    const files: JsDelivrFileNode[] = [
      {
        type: 'directory',
        name: '.cursor',
        files: [
          {
            type: 'directory',
            name: 'rules',
            files: [
              { type: 'file', name: 'coding-style.md', size: 100 },
              { type: 'file', name: 'testing.md', size: 80 },
              { type: 'file', name: 'config.json', size: 50 },
            ],
          },
        ],
      },
    ]

    const result = discoverAgentFiles(files)

    expect(result).toContain('.cursor/rules/coding-style.md')
    expect(result).toContain('.cursor/rules/testing.md')
    expect(result).not.toContain('.cursor/rules/config.json')
    expect(result).toHaveLength(2)
  })

  it('discovers .windsurf/rules/*.md files', () => {
    const files: JsDelivrFileNode[] = [
      {
        type: 'directory',
        name: '.windsurf',
        files: [
          {
            type: 'directory',
            name: 'rules',
            files: [{ type: 'file', name: 'project.md', size: 200 }],
          },
        ],
      },
    ]

    const result = discoverAgentFiles(files)

    expect(result).toEqual(['.windsurf/rules/project.md'])
  })

  it('returns empty array for empty file tree', () => {
    expect(discoverAgentFiles([])).toEqual([])
  })

  it('returns empty array when no agent files exist', () => {
    const files: JsDelivrFileNode[] = [
      { type: 'file', name: 'package.json', size: 500 },
      { type: 'file', name: 'index.js', size: 1000 },
      {
        type: 'directory',
        name: 'src',
        files: [{ type: 'file', name: 'main.ts', size: 200 }],
      },
    ]

    expect(discoverAgentFiles(files)).toEqual([])
  })
})

describe('fetchAgentFiles', () => {
  it('fetches files in parallel and returns results', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('CLAUDE.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Claude instructions') })
      }
      if (url.includes('AGENTS.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Agent config') })
      }
      return Promise.resolve({ ok: false })
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await fetchAgentFiles('test-pkg', '1.0.0', ['CLAUDE.md', 'AGENTS.md'])

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        path: 'CLAUDE.md',
        content: '# Claude instructions',
        displayName: 'Claude Code',
      })
      expect(result[1]).toMatchObject({
        path: 'AGENTS.md',
        content: '# Agent config',
        displayName: 'Agent Instructions',
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('gracefully skips failed fetches', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('CLAUDE.md')) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('# Claude') })
      }
      return Promise.resolve({ ok: false })
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      const result = await fetchAgentFiles('test-pkg', '1.0.0', ['CLAUDE.md', 'missing.md'])

      expect(result).toHaveLength(1)
      expect(result[0]?.path).toBe('CLAUDE.md')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('gracefully handles network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    try {
      const result = await fetchAgentFiles('test-pkg', '1.0.0', ['CLAUDE.md'])
      expect(result).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('returns empty array for empty file paths', async () => {
    const result = await fetchAgentFiles('test-pkg', '1.0.0', [])
    expect(result).toEqual([])
  })

  it('constructs correct CDN URLs for scoped packages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('content'),
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await fetchAgentFiles('@nuxt/kit', '1.0.0', ['CLAUDE.md'])
      expect(fetchMock).toHaveBeenCalledWith(
        'https://cdn.jsdelivr.net/npm/@nuxt/kit@1.0.0/CLAUDE.md',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('generateLlmsTxt', () => {
  it('generates full output with all fields', () => {
    const result: LlmsTxtResult = {
      packageName: 'nuxt',
      version: '3.12.0',
      description: 'The Intuitive Vue Framework',
      homepage: 'https://nuxt.com',
      repositoryUrl: 'https://github.com/nuxt/nuxt',
      readme: '# Nuxt\n\nThe Intuitive Vue Framework.',
      agentFiles: [
        {
          path: 'CLAUDE.md',
          content: '# Claude\n\nUse Nuxt conventions.',
          displayName: 'Claude Code',
        },
        { path: '.cursorrules', content: 'Use composition API.', displayName: 'Cursor Rules' },
      ],
    }

    const output = generateLlmsTxt(result)

    expect(output).toContain('# nuxt@3.12.0')
    expect(output).toContain('> The Intuitive Vue Framework')
    expect(output).toContain('- Homepage: https://nuxt.com')
    expect(output).toContain('- Repository: https://github.com/nuxt/nuxt')
    expect(output).toContain('- npm: https://www.npmjs.com/package/nuxt/v/3.12.0')
    expect(output).toContain('## README')
    expect(output).toContain('# Nuxt')
    expect(output).toContain('## Agent Instructions')
    expect(output).toContain('### Claude Code (`CLAUDE.md`)')
    expect(output).toContain('Use Nuxt conventions.')
    expect(output).toContain('### Cursor Rules (`.cursorrules`)')
    expect(output).toContain('Use composition API.')
    expect(output.endsWith('\n')).toBe(true)
  })

  it('generates minimal output with no optional fields', () => {
    const result: LlmsTxtResult = {
      packageName: 'tiny-pkg',
      version: '0.1.0',
      agentFiles: [],
    }

    const output = generateLlmsTxt(result)

    expect(output).toContain('# tiny-pkg@0.1.0')
    expect(output).toContain('- npm: https://www.npmjs.com/package/tiny-pkg/v/0.1.0')
    expect(output).not.toContain('>')
    expect(output).not.toContain('Homepage')
    expect(output).not.toContain('Repository')
    expect(output).not.toContain('## README')
    expect(output).not.toContain('## Agent Instructions')
  })

  it('omits Agent Instructions section when no agent files exist', () => {
    const result: LlmsTxtResult = {
      packageName: 'test-pkg',
      version: '1.0.0',
      description: 'A test package',
      readme: '# Test\n\nHello world.',
      agentFiles: [],
    }

    const output = generateLlmsTxt(result)

    expect(output).toContain('## README')
    expect(output).not.toContain('## Agent Instructions')
  })

  it('omits README section when no readme provided', () => {
    const result: LlmsTxtResult = {
      packageName: 'no-readme',
      version: '1.0.0',
      agentFiles: [
        { path: 'AGENTS.md', content: 'Agent rules here.', displayName: 'Agent Instructions' },
      ],
    }

    const output = generateLlmsTxt(result)

    expect(output).not.toContain('## README')
    expect(output).toContain('## Agent Instructions')
    expect(output).toContain('### Agent Instructions (`AGENTS.md`)')
  })

  it('handles scoped package names in npm URL', () => {
    const result: LlmsTxtResult = {
      packageName: '@nuxt/kit',
      version: '1.0.0',
      agentFiles: [],
    }

    const output = generateLlmsTxt(result)

    expect(output).toContain('# @nuxt/kit@1.0.0')
    expect(output).toContain('- npm: https://www.npmjs.com/package/@nuxt/kit/v/1.0.0')
  })
})

describe('generateRootLlmsTxt', () => {
  it('includes all route patterns', () => {
    const output = generateRootLlmsTxt('https://npmx.dev')

    expect(output).toContain('# npmx.dev')
    expect(output).toContain('https://npmx.dev/package/<name>/llms.txt')
    expect(output).toContain('https://npmx.dev/package/<name>/v/<version>/llms.txt')
    expect(output).toContain('https://npmx.dev/package/@<org>/<name>/llms.txt')
    expect(output).toContain('https://npmx.dev/package/@<org>/<name>/v/<version>/llms.txt')
    expect(output).toContain('https://npmx.dev/package/<name>/llms_full.txt')
    expect(output).toContain('https://npmx.dev/package/@<org>/llms.txt')
  })

  it('includes example links', () => {
    const output = generateRootLlmsTxt('https://npmx.dev')

    expect(output).toContain('[nuxt llms.txt](https://npmx.dev/package/nuxt/llms.txt)')
    expect(output).toContain('[@nuxt org packages](https://npmx.dev/package/@nuxt/llms.txt)')
  })

  it('uses provided base URL', () => {
    const output = generateRootLlmsTxt('http://localhost:3000')

    expect(output).toContain('http://localhost:3000/package/<name>/llms.txt')
    expect(output).not.toContain('https://npmx.dev')
  })

  it('ends with newline', () => {
    const output = generateRootLlmsTxt('https://npmx.dev')
    expect(output.endsWith('\n')).toBe(true)
  })

  it('includes .md route patterns', () => {
    const output = generateRootLlmsTxt('https://npmx.dev')

    expect(output).toContain('https://npmx.dev/package/<name>.md')
    expect(output).toContain('https://npmx.dev/package/@<org>/<name>.md')
    expect(output).not.toContain('<name>/v/<version>.md')
  })

  it('includes .md example links', () => {
    const output = generateRootLlmsTxt('https://npmx.dev')

    expect(output).toContain('[nuxt README](https://npmx.dev/package/nuxt.md)')
  })
})
