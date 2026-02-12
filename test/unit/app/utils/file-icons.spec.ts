import { describe, expect, it } from 'vitest'
import { getFileIcon } from '../../../../app/utils/file-icons'

describe('getFileIcon', () => {
  it('returns correct icons for exact filename matches', () => {
    expect(getFileIcon('package.json')).toBe('vscode-icons-file-type-npm')
    expect(getFileIcon('Dockerfile')).toBe('vscode-icons-file-type-docker')
    expect(getFileIcon('.gitignore')).toBe('vscode-icons-file-type-git')
    expect(getFileIcon('eslint.config.js')).toBe('vscode-icons-file-type-eslint')
    expect(getFileIcon('vitest.config.ts')).toBe('vscode-icons-file-type-vitest')
    expect(getFileIcon('.env')).toBe('vscode-icons-file-type-dotenv')
  })

  it('returns correct icons for compound extensions', () => {
    expect(getFileIcon('types.d.ts')).toBe('vscode-icons-file-type-typescriptdef')
    expect(getFileIcon('utils.test.ts')).toBe('vscode-icons-file-type-testts')
    expect(getFileIcon('utils.spec.js')).toBe('vscode-icons-file-type-testjs')
    expect(getFileIcon('Button.stories.tsx')).toBe('vscode-icons-file-type-storybook')
  })

  it('returns correct icons for simple extensions', () => {
    expect(getFileIcon('index.js')).toBe('vscode-icons-file-type-js-official')
    expect(getFileIcon('main.ts')).toBe('vscode-icons-file-type-typescript-official')
    expect(getFileIcon('App.vue')).toBe('vscode-icons-file-type-vue')
    expect(getFileIcon('data.json')).toBe('vscode-icons-file-type-json')
    expect(getFileIcon('build.sh')).toBe('vscode-icons-file-type-shell')
    expect(getFileIcon('script.py')).toBe('vscode-icons-file-type-python')
    expect(getFileIcon('lib.rs')).toBe('vscode-icons-file-type-rust')
    expect(getFileIcon('logo.png')).toBe('vscode-icons-file-type-image')
    expect(getFileIcon('archive.tar')).toBe('vscode-icons-file-type-zip')
  })

  it('returns default icon for unknown files', () => {
    expect(getFileIcon('file.xyz')).toBe('vscode-icons-default-file')
    expect(getFileIcon('unknownfile')).toBe('vscode-icons-default-file')
  })

  it('prefers exact filename over extension, and compound over simple', () => {
    expect(getFileIcon('package.json')).toBe('vscode-icons-file-type-npm')
    expect(getFileIcon('foo.test.ts')).toBe('vscode-icons-file-type-testts')
  })
})
