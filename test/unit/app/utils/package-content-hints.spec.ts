import { describe, expect, it } from 'vitest'
import { isPossiblyUnnecessaryContent } from '~/utils/package-content-hints'

describe('isPossiblyUnnecessaryContent', () => {
  it('flags well-known editor and config filenames', () => {
    expect(isPossiblyUnnecessaryContent('.editorconfig', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.gitignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.gitattributes', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.prettierignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.jshintignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.npmignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('tsconfig.json', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('jsconfig.json', 'file')).toBe(true)
  })

  it('flags local environment files', () => {
    expect(isPossiblyUnnecessaryContent('.env', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.local', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.development', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.development.local', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.test', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.test.local', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.production.local', 'file')).toBe(true)
  })

  it('flags node version files and coverage configs', () => {
    expect(isPossiblyUnnecessaryContent('.node-version', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.nvmrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('mise.toml', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.tool-versions', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.nycrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('nyc.json', 'file')).toBe(true)
  })

  it('flags editor and CI files', () => {
    expect(isPossiblyUnnecessaryContent('.travis.yml', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.verb.md', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('Makefile', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.DS_Store', 'file')).toBe(true)
  })

  it('flags package manager lockfiles', () => {
    expect(isPossiblyUnnecessaryContent('yarn.lock', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('bun.lock', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('bun.lockb', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('package-lock.json', 'file')).toBe(true)
  })

  it('flags example and development files', () => {
    expect(isPossiblyUnnecessaryContent('test.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('tests.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('test.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('index.test.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('index.test.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('index.spec.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('index.spec.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('bench.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('benchmark.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('example.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('examples.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('example.mjs', 'file')).toBe(true)
  })

  it('flags unnecessay metadata and documentation files', () => {
    expect(isPossiblyUnnecessaryContent('AUTHORS', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('collaborators.md', 'file')).toBe(true)
  })

  describe('changelog, release notes, and contributing files', () => {
    const files = [
      'CHANGELOG.md',
      'Changelog.md',
      'changelog.md',
      'CHANGELOG.markdown',
      'changelog.markdown',
      'RELEASENOTES.md',
      'release-notes.md',
      'CONTRIBUTING.md',
      'HISTORY.md',
      'History.md',
      'history.txt',
      'NEWS.md',
    ]
    for (const name of files) {
      it(`flags ${name}`, () => {
        expect(isPossiblyUnnecessaryContent(name, 'file')).toBe(true)
      })
    }
  })

  describe('configuration patterns', () => {
    it('matches ESLint configuration patterns', () => {
      for (const extension of ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts']) {
        expect(isPossiblyUnnecessaryContent(`eslint.config.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('.eslintrc', 'file')).toBe(true)
      for (const extension of ['json', 'js', 'cjs', 'yml', 'yaml']) {
        expect(isPossiblyUnnecessaryContent(`.eslintrc.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('eslint.config.json', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.eslintrc.txt', 'file')).toBe(false)
    })

    it('matches Prettier configuration patterns', () => {
      expect(isPossiblyUnnecessaryContent('.prettierrc', 'file')).toBe(true)
      for (const extension of ['json', 'js', 'cjs', 'yml', 'yaml', 'toml']) {
        expect(isPossiblyUnnecessaryContent(`.prettierrc.${extension}`, 'file')).toBe(true)
      }
      for (const extension of ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts']) {
        expect(isPossiblyUnnecessaryContent(`prettier.config.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('.prettierrc.txt', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('prettier.config.json', 'file')).toBe(false)
    })

    it('matches oxlint and oxfmt configuration patterns', () => {
      for (const extension of ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts']) {
        expect(isPossiblyUnnecessaryContent(`oxlint.config.${extension}`, 'file')).toBe(true)
        expect(isPossiblyUnnecessaryContent(`oxfmt.config.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('.oxlintrc', 'file')).toBe(true)
      expect(isPossiblyUnnecessaryContent('.oxfmtrc', 'file')).toBe(true)
      for (const extension of ['json', 'js', 'cjs', 'yml', 'yaml']) {
        expect(isPossiblyUnnecessaryContent(`.oxlintrc.${extension}`, 'file')).toBe(true)
        expect(isPossiblyUnnecessaryContent(`.oxfmtrc.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('oxlint.config.json', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('oxfmt.config.json', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.oxlintrc.txt', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.oxfmtrc.txt', 'file')).toBe(false)
    })

    it('matches jest configuration patterns', () => {
      for (const extension of ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts']) {
        expect(isPossiblyUnnecessaryContent(`jest.config.${extension}`, 'file')).toBe(true)
      }
    })

    it('matches common dot-prefixed configuration patterns without over-flagging', () => {
      expect(isPossiblyUnnecessaryContent('.babelrc', 'file')).toBe(true)
      for (const extension of ['json', 'js', 'cjs', 'mjs', 'yml', 'yaml', 'toml']) {
        expect(isPossiblyUnnecessaryContent(`.stylelintrc.${extension}`, 'file')).toBe(true)
      }
      expect(isPossiblyUnnecessaryContent('.browserslistrc', 'file')).toBe(true)
      for (const extension of ['js', 'cjs', 'mjs', 'ts', 'mts', 'cts']) {
        expect(isPossiblyUnnecessaryContent(`.tailwind.config.${extension}`, 'file')).toBe(true)
      }
      // .npmrc is sometimes an intentional shipped artifact; do not flag it.
      expect(isPossiblyUnnecessaryContent('.npmrc', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.npmrc.json', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.stylelintrc.ts', 'file')).toBe(false)
      expect(isPossiblyUnnecessaryContent('.tailwind.config.json', 'file')).toBe(false)
    })
  })

  it('flags editor and CI directories', () => {
    expect(isPossiblyUnnecessaryContent('.vscode', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.claude', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.github', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.idea', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.zed', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.yarn', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.husky', 'directory')).toBe(true)
  })

  it('flags test directories', () => {
    expect(isPossiblyUnnecessaryContent('test', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('tests', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('__tests__', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('__mocks__', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('__snapshots__', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('spec', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('specs', 'directory')).toBe(true)
  })

  it('flags development directories', () => {
    expect(isPossiblyUnnecessaryContent('benchmark', 'directory')).toBe(true)
  })

  it('flags example directories', () => {
    expect(isPossiblyUnnecessaryContent('example', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('examples', 'directory')).toBe(true)
  })

  it('does not flag ordinary source files or directories', () => {
    expect(isPossiblyUnnecessaryContent('index.js', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('latest.js', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('package.json', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('README.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('readme.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('main.ts', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('src', 'directory')).toBe(false)
    expect(isPossiblyUnnecessaryContent('lib', 'directory')).toBe(false)
    expect(isPossiblyUnnecessaryContent('dist', 'directory')).toBe(false)
  })

  it('does not flag legal related files', () => {
    expect(isPossiblyUnnecessaryContent('LICENSE', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENCE', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('license', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('licence', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENSE.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENCE.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENSE-MIT', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENSE-MIT.txt', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('NOTICE', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('NOTICE.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('UNLICENSE', 'file')).toBe(false)
  })

  it('does not confuse a directory name passed as a file with the directory match', () => {
    expect(isPossiblyUnnecessaryContent('.vscode', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('test', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('tsconfig.json', 'directory')).toBe(false)
  })

  it('treats matching as case-sensitive (npm packages live in a case-sensitive world)', () => {
    expect(isPossiblyUnnecessaryContent('TSCONFIG.JSON', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('.VSCode', 'directory')).toBe(false)
  })
})
