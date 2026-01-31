import { Volume } from 'memfs'
import { describe, expect, it } from 'vitest'

import { DEFAULT_EXCLUDE_PATTERNS, fetchPackagesToVolume } from './fetch'
import { hoist } from './hoist'
import { resolve } from './resolve'

// #region fetchPackagesToVolume

describe('fetchPackagesToVolume', () => {
  describe('basic fetching', () => {
    it('fetches and extracts a simple package with dependencies', async () => {
      const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
      const hoisted = hoist(result.roots)
      const volume = new Volume()
      await fetchPackagesToVolume(hoisted, volume)

      // verify is-odd
      const isOddPackageJson = volume.readFileSync('/node_modules/is-odd/package.json', 'utf8')
      const json = JSON.parse(isOddPackageJson as string)
      expect(json.name).toBe('is-odd')

      // verify dependency (is-number)
      const isNumberPackageJson = volume.readFileSync(
        '/node_modules/is-number/package.json',
        'utf8',
      )
      expect(isNumberPackageJson).toBeDefined()
    })

    it('respects concurrency limit', async () => {
      const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
      const hoisted = hoist(result.roots)
      const volume = new Volume()

      await fetchPackagesToVolume(hoisted, volume, { concurrency: 1 })
      expect(Object.keys(volume.toJSON()).length).toBeGreaterThan(0)
    })
  })

  describe('scoped packages', () => {
    it('fetches scoped packages correctly', async () => {
      const result = await resolve(['@babel/parser@7.23.0'], { installPeers: false })
      const hoisted = hoist(result.roots)
      const volume = new Volume()
      await fetchPackagesToVolume(hoisted, volume)

      const packageJson = volume.readFileSync('/node_modules/@babel/parser/package.json', 'utf8')
      const json = JSON.parse(packageJson as string)
      expect(json.name).toBe('@babel/parser')
    })
  })

  describe('nested packages', () => {
    it('handles version conflicts with nested packages', async () => {
      // is-odd depends on is-number@6.x, but we also request is-number@7.x
      const result = await resolve(['is-odd@3.0.1', 'is-number@7.0.0'], { installPeers: false })
      const hoisted = hoist(result.roots)
      const volume = new Volume()
      await fetchPackagesToVolume(hoisted, volume)

      // is-number@7 at root (explicitly requested)
      const rootIsNumber = volume.readFileSync('/node_modules/is-number/package.json', 'utf8')
      const rootJson = JSON.parse(rootIsNumber as string)
      expect(rootJson.version).toBe('7.0.0')

      // is-number@6 nested under is-odd
      const files = volume.toJSON()
      const nestedIsNumber = Object.keys(files).find(p =>
        p.includes('/is-odd/node_modules/is-number/'),
      )
      expect(nestedIsNumber).toBeDefined()
    })
  })

  describe('file exclusions', () => {
    it('excludes files matching default patterns', async () => {
      const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
      const hoisted = hoist(result.roots)
      const volume = new Volume()
      await fetchPackagesToVolume(hoisted, volume)

      const files = volume.toJSON()
      for (const path of Object.keys(files)) {
        const filename = path.split('/').pop()!
        expect(filename.toUpperCase()).not.toMatch(/^README/)
        expect(filename.toUpperCase()).not.toMatch(/^LICENSE/)
      }
    })

    it('can disable exclusions with empty array', async () => {
      const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
      const hoisted = hoist(result.roots)

      const volumeNoExclude = new Volume()
      await fetchPackagesToVolume(hoisted, volumeNoExclude, { exclude: [] })

      const volumeWithExclude = new Volume()
      await fetchPackagesToVolume(hoisted, volumeWithExclude)

      const noExcludeCount = Object.keys(volumeNoExclude.toJSON()).length
      const withExcludeCount = Object.keys(volumeWithExclude.toJSON()).length
      expect(noExcludeCount).toBeGreaterThanOrEqual(withExcludeCount)
    })
  })
})

// #endregion

// #region unpackedSize calculation

describe('unpackedSize calculation', () => {
  it('populates unpackedSize from tarball when registry does not provide it', async () => {
    // JSR packages don't have unpackedSize in registry metadata
    const result = await resolve(['jsr:@luca/flag@1.0.1'])
    const hoisted = hoist(result.roots)
    const volume = new Volume()

    const rootNode = hoisted.root.get('@luca/flag')!
    expect(rootNode.unpackedSize).toBeUndefined()

    await fetchPackagesToVolume(hoisted, volume)

    expect(rootNode.unpackedSize).toBeGreaterThan(0)
  })

  it('preserves registry-provided unpackedSize for npm packages', async () => {
    const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
    const hoisted = hoist(result.roots)
    const volume = new Volume()

    const rootNode = hoisted.root.get('is-odd')!
    const registrySize = rootNode.unpackedSize
    expect(registrySize).toBeGreaterThan(0)

    await fetchPackagesToVolume(hoisted, volume)

    expect(rootNode.unpackedSize).toBe(registrySize)
  })

  it('includes excluded files in size calculation', async () => {
    const result = await resolve(['is-odd@3.0.1'], { installPeers: false })
    const hoisted = hoist(result.roots)

    // clear registry-provided size to force calculation from tarball
    const rootNode = hoisted.root.get('is-odd')!
    rootNode.unpackedSize = undefined

    const volume = new Volume()
    await fetchPackagesToVolume(hoisted, volume)

    const extractedFiles = volume.toJSON()
    const extractedSize = Object.values(extractedFiles).reduce(
      (sum, content) => sum + (content as string).length,
      0,
    )

    // tarball size >= extracted size (includes excluded files)
    expect(rootNode.unpackedSize).toBeGreaterThanOrEqual(extractedSize)
  })
})

// #endregion

// #region DEFAULT_EXCLUDE_PATTERNS

describe('DEFAULT_EXCLUDE_PATTERNS', () => {
  describe('documentation files', () => {
    it('matches README files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('README.md'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('README'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('readme.txt'))).toBe(true)
    })

    it('matches LICENSE files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('LICENSE'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('LICENSE.md'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('LICENCE'))).toBe(true)
    })

    it('matches CHANGELOG and HISTORY files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('CHANGELOG.md'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('HISTORY.md'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('changelog.txt'))).toBe(true)
    })

    it('matches example directories', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('examples/basic.js'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('example/demo.ts'))).toBe(true)
    })
  })

  describe('test files', () => {
    it('matches test directories', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('__tests__/foo.js'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('test/index.js'))).toBe(true)
    })

    it('matches test file patterns', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('foo.test.js'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('bar.spec.ts'))).toBe(true)
    })
  })

  describe('config files', () => {
    it('matches TypeScript config files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('tsconfig.json'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('tsconfig.build.json'))).toBe(true)
    })

    it('matches linter configs', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('.eslintrc'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('.eslintrc.json'))).toBe(true)
    })

    it('matches test runner configs', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('jest.config.js'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('vitest.config.ts'))).toBe(true)
    })

    it('matches dot directories', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('.github/workflows/ci.yml'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('.vscode/settings.json'))).toBe(true)
    })
  })

  describe('type definition files', () => {
    it('matches TypeScript declaration files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.d.ts'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('types.d.mts'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('lib/foo.d.cts'))).toBe(true)
    })

    it('matches Flow type files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.js.flow'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('types.flow'))).toBe(true)
    })

    it('does not match TypeScript source files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.ts'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.mts'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.cts'))).toBe(false)
    })
  })

  describe('source maps', () => {
    it('matches source map files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.js.map'))).toBe(true)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('dist/bundle.js.map'))).toBe(true)
    })
  })

  describe('source files (should NOT match)', () => {
    it('does not match JavaScript/TypeScript source files', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('index.js'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('src/utils.ts'))).toBe(false)
    })

    it('does not match package.json', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('package.json'))).toBe(false)
    })

    it('does not match dist/lib directories', () => {
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('dist/index.js'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('lib/index.js'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('cjs/index.js'))).toBe(false)
      expect(DEFAULT_EXCLUDE_PATTERNS.some(p => p.test('esm/index.js'))).toBe(false)
    })
  })
})

// #endregion
