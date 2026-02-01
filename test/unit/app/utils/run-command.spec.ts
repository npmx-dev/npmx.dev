import { describe, expect, it } from 'vitest'
import {
  getExecutableInfo,
  getRunCommand,
  getRunCommandParts,
  isBinaryOnlyPackage,
  isCreatePackage,
} from '../../../../app/utils/run-command'
import type { JsrPackageInfo } from '../../../../shared/types/jsr'

describe('executable detection and run commands', () => {
  const jsrNotAvailable: JsrPackageInfo = { exists: false }

  describe('getExecutableInfo', () => {
    it('returns hasExecutable: false for undefined bin', () => {
      const info = getExecutableInfo('some-package', undefined)
      expect(info).toEqual({
        primaryCommand: '',
        commands: [],
        hasExecutable: false,
      })
    })

    it('handles string bin format (package name becomes command)', () => {
      const info = getExecutableInfo('eslint', './bin/eslint.js')
      expect(info).toEqual({
        primaryCommand: 'eslint',
        commands: ['eslint'],
        hasExecutable: true,
      })
    })

    it('handles object bin format with single command', () => {
      const info = getExecutableInfo('cowsay', { cowsay: './index.js' })
      expect(info).toEqual({
        primaryCommand: 'cowsay',
        commands: ['cowsay'],
        hasExecutable: true,
      })
    })

    it('handles object bin format with multiple commands', () => {
      const info = getExecutableInfo('typescript', {
        tsc: './bin/tsc',
        tsserver: './bin/tsserver',
      })
      expect(info).toEqual({
        primaryCommand: 'tsc',
        commands: ['tsc', 'tsserver'],
        hasExecutable: true,
      })
    })

    it('prefers command matching package name as primary', () => {
      const info = getExecutableInfo('eslint', {
        'eslint-cli': './cli.js',
        'eslint': './index.js',
      })
      expect(info.primaryCommand).toBe('eslint')
    })

    it('prefers command matching base name for scoped packages', () => {
      const info = getExecutableInfo('@scope/myapp', {
        'myapp': './index.js',
        'myapp-extra': './extra.js',
      })
      expect(info.primaryCommand).toBe('myapp')
    })

    it('returns empty for empty bin object', () => {
      const info = getExecutableInfo('some-package', {})
      expect(info).toEqual({
        primaryCommand: '',
        commands: [],
        hasExecutable: false,
      })
    })
  })

  describe('getRunCommandParts', () => {
    // Default behavior uses local execute (for installed packages)
    it.each([
      ['npm', ['npx', 'eslint']],
      ['pnpm', ['pnpm', 'exec', 'eslint']],
      ['yarn', ['yarn', 'eslint']],
      ['bun', ['bunx', 'eslint']],
      ['deno', ['deno', 'run', 'npm:eslint']],
      ['vlt', ['vlt', 'x', 'eslint']],
    ] as const)('%s (local) → %s', (pm, expected) => {
      expect(
        getRunCommandParts({
          packageName: 'eslint',
          packageManager: pm,
          jsrInfo: jsrNotAvailable,
        }),
      ).toEqual(expected)
    })

    // Binary-only packages use remote execute (download & run)
    it.each([
      ['npm', ['npx', 'create-vite']],
      ['pnpm', ['pnpm', 'dlx', 'create-vite']],
      ['yarn', ['yarn', 'dlx', 'create-vite']],
      ['bun', ['bunx', 'create-vite']],
      ['deno', ['deno', 'run', 'npm:create-vite']],
      ['vlt', ['vlt', 'x', 'create-vite']],
    ] as const)('%s (remote) → %s', (pm, expected) => {
      expect(
        getRunCommandParts({
          packageName: 'create-vite',
          packageManager: pm,
          jsrInfo: jsrNotAvailable,
          isBinaryOnly: true,
        }),
      ).toEqual(expected)
    })

    it('uses command name directly for multi-bin packages', () => {
      const parts = getRunCommandParts({
        packageName: 'typescript',
        packageManager: 'npm',
        command: 'tsserver',
        jsrInfo: jsrNotAvailable,
      })
      // npx tsserver runs the tsserver command (not npx typescript/tsserver)
      expect(parts).toEqual(['npx', 'tsserver'])
    })

    it('uses base name directly when command matches package base name', () => {
      const parts = getRunCommandParts({
        packageName: '@scope/myapp',
        packageManager: 'npm',
        command: 'myapp',
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual(['npx', '@scope/myapp'])
    })

    it('returns empty array for invalid package manager', () => {
      const parts = getRunCommandParts({
        packageName: 'eslint',
        packageManager: 'invalid' as any,
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual([])
    })
  })

  describe('getRunCommand', () => {
    it('generates full run command string', () => {
      expect(
        getRunCommand({
          packageName: 'eslint',
          packageManager: 'npm',
          jsrInfo: jsrNotAvailable,
        }),
      ).toBe('npx eslint')
    })

    it('generates correct bun run command with specific command', () => {
      expect(
        getRunCommand({
          packageName: 'typescript',
          packageManager: 'bun',
          command: 'tsserver',
          jsrInfo: jsrNotAvailable,
        }),
      ).toBe('bunx tsserver')
    })

    it('joined parts match getRunCommand output', () => {
      const options = {
        packageName: 'eslint',
        packageManager: 'pnpm' as const,
        jsrInfo: jsrNotAvailable,
      }
      const parts = getRunCommandParts(options)
      const command = getRunCommand(options)
      expect(parts.join(' ')).toBe(command)
    })
  })

  describe('isBinaryOnlyPackage', () => {
    it('returns true for create-* packages', () => {
      expect(isBinaryOnlyPackage({ name: 'create-vite' })).toBe(true)
      expect(isBinaryOnlyPackage({ name: 'create-next-app' })).toBe(true)
    })

    it('returns true for scoped create packages', () => {
      expect(isBinaryOnlyPackage({ name: '@vue/create-app' })).toBe(true)
      expect(isBinaryOnlyPackage({ name: '@scope/create-something' })).toBe(true)
    })

    it('returns true for packages with bin but no entry points', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'degit',
          bin: { degit: './bin.js' },
        }),
      ).toBe(true)
    })

    it('returns false for packages with bin AND entry points', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'eslint',
          bin: { eslint: './bin/eslint.js' },
          main: './lib/api.js',
        }),
      ).toBe(false)
    })

    it('returns false for packages with exports', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'some-package',
          bin: { cmd: './bin.js' },
          exports: { '.': './index.js' },
        }),
      ).toBe(false)
    })

    it('returns false for packages without bin', () => {
      expect(
        isBinaryOnlyPackage({
          name: 'lodash',
          main: './lodash.js',
        }),
      ).toBe(false)
    })
  })

  describe('isCreatePackage', () => {
    it('returns true for create-* packages', () => {
      expect(isCreatePackage('create-vite')).toBe(true)
      expect(isCreatePackage('create-next-app')).toBe(true)
    })

    it('returns true for scoped create packages', () => {
      expect(isCreatePackage('@vue/create-app')).toBe(true)
    })

    it('returns false for regular packages', () => {
      expect(isCreatePackage('eslint')).toBe(false)
      expect(isCreatePackage('lodash')).toBe(false)
      expect(isCreatePackage('@scope/utils')).toBe(false)
    })
  })
})
