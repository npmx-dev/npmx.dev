import { describe, expect, it } from 'vitest'
import { getFileIcon } from '../../../../app/utils/file-icons'

describe('getFileIcon', () => {
  it('returns correct icons for exact filename matches', () => {
    expect(getFileIcon('package.json')).toBe('i-vscode-icons-file-type-npm')
    expect(getFileIcon('Dockerfile')).toBe('i-vscode-icons-file-type-docker')
    expect(getFileIcon('.gitignore')).toBe('i-vscode-icons-file-type-git')
    expect(getFileIcon('eslint.config.js')).toBe('i-vscode-icons-file-type-eslint')
    expect(getFileIcon('vitest.config.ts')).toBe('i-vscode-icons-file-type-vitest')
    expect(getFileIcon('.env')).toBe('i-vscode-icons-file-type-dotenv')
  })

  it('returns correct icons for compound extensions', () => {
    expect(getFileIcon('types.d.ts')).toBe('i-vscode-icons-file-type-typescriptdef')
    expect(getFileIcon('utils.test.ts')).toBe('i-vscode-icons-file-type-testts')
    expect(getFileIcon('utils.spec.js')).toBe('i-vscode-icons-file-type-testjs')
    expect(getFileIcon('Button.stories.tsx')).toBe('i-vscode-icons-file-type-storybook')
  })

  it('returns correct icons for simple extensions', () => {
    expect(getFileIcon('index.js')).toBe('i-vscode-icons-file-type-js-official')
    expect(getFileIcon('main.ts')).toBe('i-vscode-icons-file-type-typescript-official')
    expect(getFileIcon('App.vue')).toBe('i-vscode-icons-file-type-vue')
    expect(getFileIcon('data.json')).toBe('i-vscode-icons-file-type-json')
    expect(getFileIcon('build.sh')).toBe('i-vscode-icons-file-type-shell')
    expect(getFileIcon('script.py')).toBe('i-vscode-icons-file-type-python')
    expect(getFileIcon('lib.rs')).toBe('i-vscode-icons-file-type-rust')
    expect(getFileIcon('logo.png')).toBe('i-vscode-icons-file-type-image')
    expect(getFileIcon('archive.tar')).toBe('i-vscode-icons-file-type-zip')
  })

  it('returns default icon for unknown files', () => {
    expect(getFileIcon('file.xyz')).toBe('i-vscode-icons-default-file')
    expect(getFileIcon('unknownfile')).toBe('i-vscode-icons-default-file')
  })

  it('prefers exact filename over extension, and compound over simple', () => {
    expect(getFileIcon('package.json')).toBe('i-vscode-icons-file-type-npm')
    expect(getFileIcon('foo.test.ts')).toBe('i-vscode-icons-file-type-testts')
  })
})
