import { describe, expect, it } from 'vitest'
import { generatePackageMarkdown, generateSparkline } from '../../../../server/utils/markdown'
import type { Packument, PackumentVersion } from '#shared/types'

describe('markdown utils', () => {
  describe('generateSparkline', () => {
    it('returns empty string for empty array', () => {
      expect(generateSparkline([])).toBe('')
    })

    it('returns middle bars for constant values', () => {
      expect(generateSparkline([5, 5, 5, 5])).toBe('▄▄▄▄')
    })

    it('generates sparkline for ascending values', () => {
      const result = generateSparkline([1, 2, 3, 4, 5])
      expect(result).toBe(' ▂▄▆█')
    })

    it('generates sparkline for descending values', () => {
      const result = generateSparkline([5, 4, 3, 2, 1])
      expect(result).toBe('█▆▄▂ ')
    })

    it('handles single value', () => {
      expect(generateSparkline([100])).toBe('▄')
    })

    it('handles values with large range', () => {
      const result = generateSparkline([0, 1000000])
      expect(result).toBe(' █')
    })
  })

  describe('generatePackageMarkdown', () => {
    const createMockPkg = (overrides?: Partial<Packument>): Packument =>
      ({
        _id: 'test-package',
        _rev: '1-abc',
        name: 'test-package',
        description: 'A test package',
        license: 'MIT',
        maintainers: [{ name: 'Test User', email: 'test@example.com' }],
        time: {
          created: '2024-01-01T00:00:00.000Z',
          modified: '2024-06-15T00:00:00.000Z',
        },
        ...overrides,
      }) as Packument

    const createMockVersion = (overrides?: Partial<PackumentVersion>): PackumentVersion =>
      ({
        name: 'test-package',
        version: '1.0.0',
        dependencies: {},
        keywords: ['test', 'package'],
        dist: {
          tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
          shasum: 'abc123',
        },
        ...overrides,
      }) as PackumentVersion

    it('generates markdown with basic package info', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('# test-package')
      expect(result).toContain('> A test package')
      expect(result).toContain('**Version:** 1.0.0')
      expect(result).toContain('**License:** MIT')
    })

    it('includes install command', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('## Install')
      expect(result).toContain('npm install test-package')
    })

    it('includes npm link', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [npm](https://www.npmjs.com/package/test-package)')
    })

    it('includes repository link when available', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Repository](https://github.com/user/repo)')
    })

    it('normalizes git+ URLs', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'git+https://github.com/user/repo.git',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Repository](https://github.com/user/repo)')
    })

    it('normalizes git:// URLs to https://', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'git://github.com/user/repo.git',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Repository](https://github.com/user/repo)')
    })

    it('normalizes SSH URLs to HTTPS', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'git@github.com:user/repo.git',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Repository](https://github.com/user/repo)')
    })

    it('skips non-HTTP URLs after normalization', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'file:///path/to/repo',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).not.toContain('- [Repository]')
    })

    it('handles monorepo packages with directory', () => {
      const pkg = createMockPkg({
        repository: {
          type: 'git',
          url: 'https://github.com/user/monorepo',
          directory: 'packages/sub-package',
        },
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain(
        '- [Repository](https://github.com/user/monorepo/tree/HEAD/packages/sub-package)',
      )
    })

    it('includes homepage link when different from repo', () => {
      const pkg = createMockPkg({
        repository: { url: 'https://github.com/user/repo' },
      })
      const version = createMockVersion({
        homepage: 'https://docs.example.com',
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Homepage](https://docs.example.com)')
    })

    it('excludes homepage when same as repo URL', () => {
      const pkg = createMockPkg({
        repository: { url: 'https://github.com/user/repo' },
      })
      const version = createMockVersion({
        homepage: 'https://github.com/user/repo',
      })

      const result = generatePackageMarkdown({ pkg, version })

      // Should only have one occurrence in Links section
      const matches = result.match(/https:\/\/github\.com\/user\/repo/g)
      expect(matches?.length).toBe(1)
    })

    it('includes bugs link when available', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        bugs: { url: 'https://github.com/user/repo/issues' },
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Issues](https://github.com/user/repo/issues)')
    })

    it('includes weekly downloads in stats', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({
        pkg,
        version,
        weeklyDownloads: 1234567,
      })

      expect(result).toContain('Downloads (weekly)')
      expect(result).toContain('1,234,567')
    })

    it('includes sparkline with download trend', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()
      const dailyDownloads = Array.from({ length: 14 }, (_, i) => ({
        day: `2024-01-${String(i + 1).padStart(2, '0')}`,
        downloads: (i + 1) * 1000,
      }))

      const result = generatePackageMarkdown({
        pkg,
        version,
        weeklyDownloads: 100000,
        dailyDownloads,
      })

      // Should contain compact numbers and sparkline
      expect(result).toMatch(/\[[\d.]+[KMB]?\s+[\d.]+[KMB]?\]/)
      expect(result).toMatch(/[▁▂▃▄▅▆▇█]/)
    })

    it('includes dependencies count', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        dependencies: {
          lodash: '^4.0.0',
          express: '^5.0.0',
        },
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('Dependencies')
      expect(result).toContain('| 2 |')
    })

    it('shows zero dependencies when none exist', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({ dependencies: undefined })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('| 0 |')
    })

    it('includes install size when provided', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({
        pkg,
        version,
        installSize: 1024 * 1024 * 2.5, // 2.5 MB
      })

      expect(result).toContain('Install Size')
      expect(result).toContain('2.5 MB')
    })

    it('includes install size of 0 when explicitly provided', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({
        pkg,
        version,
        installSize: 0,
      })

      expect(result).toContain('Install Size')
      expect(result).toContain('0 B')
    })

    it('falls back to unpacked size when no install size', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        dist: {
          tarball: 'https://example.com/tarball.tgz',
          shasum: 'abc123',
          unpackedSize: 50000,
          signatures: [],
        },
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('Package Size')
      expect(result).toContain('48.8 kB')
    })

    it('includes keywords section', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        keywords: ['test', 'package', 'npm'],
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('## Keywords')
      expect(result).toContain('test, package, npm')
    })

    it('limits keywords to 20', () => {
      const pkg = createMockPkg()
      const keywords = Array.from({ length: 30 }, (_, i) => `keyword${i}`)
      const version = createMockVersion({ keywords })

      const result = generatePackageMarkdown({ pkg, version })

      const keywordLine = result.split('\n').find(line => line.includes('keyword0'))
      expect(keywordLine?.split(',').length).toBe(20)
    })

    it('includes maintainers section', () => {
      const pkg = createMockPkg({
        maintainers: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Bob', email: 'bob@example.com' },
        ],
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('## Maintainers')
      expect(result).toContain('- Alice')
      expect(result).toContain('- Bob')
    })

    it('links maintainers with username', () => {
      const pkg = createMockPkg({
        maintainers: [{ name: 'Alice', email: 'alice@example.com', username: 'alice123' } as any],
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- [Alice](https://npmx.dev/~alice123)')
    })

    it('limits maintainers to 10', () => {
      const maintainers = Array.from({ length: 15 }, (_, i) => ({
        name: `User${i}`,
        email: `user${i}@example.com`,
      }))
      const pkg = createMockPkg({ maintainers })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('- User0')
      expect(result).toContain('- User9')
      expect(result).not.toContain('- User10')
    })

    it('includes README section when provided', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()
      const readme = '# My Package\n\nThis is the readme content.'

      const result = generatePackageMarkdown({ pkg, version, readme })

      expect(result).toContain('## README')
      expect(result).toContain('# My Package')
      expect(result).toContain('This is the readme content.')
    })

    it('truncates very long READMEs', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()
      const readme = 'x'.repeat(600 * 1024) // 600KB, over the 500KB limit

      const result = generatePackageMarkdown({ pkg, version, readme })

      expect(result).toContain('*[README truncated due to size]*')
      expect(result.length).toBeLessThan(600 * 1024)
    })

    it('omits README section when readme is empty', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version, readme: '   ' })

      expect(result).not.toContain('## README')
    })

    it('omits README section when readme is null', () => {
      const pkg = createMockPkg()
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version, readme: null })

      expect(result).not.toContain('## README')
    })

    it('escapes markdown special characters in description', () => {
      const pkg = createMockPkg({
        description: 'A *test* package with [special] _chars_',
      })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('> A \\*test\\* package with \\[special\\] \\_chars\\_')
    })

    it('handles package without description', () => {
      const pkg = createMockPkg({ description: undefined })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).toContain('# test-package')
      expect(result).not.toContain('>')
    })

    it('handles package without license', () => {
      const pkg = createMockPkg({ license: undefined })
      const version = createMockVersion()

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).not.toContain('**License:**')
    })

    it('validates homepage URLs', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        homepage: 'javascript:alert("xss")',
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).not.toContain('javascript:')
    })

    it('validates bugs URLs', () => {
      const pkg = createMockPkg()
      const version = createMockVersion({
        bugs: { url: 'file:///etc/passwd' },
      })

      const result = generatePackageMarkdown({ pkg, version })

      expect(result).not.toContain('file://')
    })
  })
})
