import { describe, expect, it } from 'vitest'
import { isPossiblyUnnecessaryContent } from '~/utils/package-content-hints'

describe('isPossiblyUnnecessaryContent', () => {
  it('flags well-known editor and config filenames', () => {
    expect(isPossiblyUnnecessaryContent('.editorconfig', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.gitignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.gitattributes', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.prettierignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintignore', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('tsconfig.json', 'file')).toBe(true)
  })

  it('flags local environment files', () => {
    expect(isPossiblyUnnecessaryContent('.env', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.local', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.development', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.env.test.local', 'file')).toBe(true)
  })

  it('flags node version files and coverage configs', () => {
    expect(isPossiblyUnnecessaryContent('.node-version', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.nvmrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('mise.toml', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.tool-versions', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.nycrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('nyc.json', 'file')).toBe(true)
  })

  it('matches ESLint configuration patterns', () => {
    expect(isPossiblyUnnecessaryContent('eslint.config.js', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('eslint.config.mjs', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('eslint.config.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintrc.json', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintrc.yml', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.eslintrc.cjs', 'file')).toBe(true)
  })

  it('matches Prettier configuration patterns', () => {
    expect(isPossiblyUnnecessaryContent('.prettierrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.prettierrc.json', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.prettierrc.yml', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('prettier.config.js', 'file')).toBe(true)
  })

  it('matches oxlint and oxfmt configuration patterns', () => {
    expect(isPossiblyUnnecessaryContent('oxlint.config.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.oxlintrc.json', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('oxfmt.config.ts', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.oxfmtrc.json', 'file')).toBe(true)
  })

  it('matches common dot-prefixed configuration patterns without over-flagging', () => {
    expect(isPossiblyUnnecessaryContent('.babelrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.stylelintrc.json', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.browserslistrc', 'file')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.tailwind.config.js', 'file')).toBe(true)
    // .npmrc is sometimes an intentional shipped artifact; do not flag it.
    expect(isPossiblyUnnecessaryContent('.npmrc', 'file')).toBe(false)
  })

  it('flags editor and CI directories', () => {
    expect(isPossiblyUnnecessaryContent('.vscode', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.claude', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.github', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.idea', 'directory')).toBe(true)
    expect(isPossiblyUnnecessaryContent('.zed', 'directory')).toBe(true)
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

  it('does not flag ordinary source files or directories', () => {
    expect(isPossiblyUnnecessaryContent('index.js', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('package.json', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('README.md', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('LICENSE', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('main.ts', 'file')).toBe(false)
    expect(isPossiblyUnnecessaryContent('src', 'directory')).toBe(false)
    expect(isPossiblyUnnecessaryContent('lib', 'directory')).toBe(false)
    expect(isPossiblyUnnecessaryContent('dist', 'directory')).toBe(false)
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
