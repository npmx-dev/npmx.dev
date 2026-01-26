import { describe, expect, it } from 'vitest'
import { getExecutableInfo, getRunCommand, getRunCommandParts } from '../../app/utils/run-command'
import type { JsrPackageInfo } from '../../shared/types/jsr'

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
    it.each([
      ['npm', ['npx', 'eslint']],
      ['pnpm', ['pnpm dlx', 'eslint']],
      ['yarn', ['yarn dlx', 'eslint']],
      ['bun', ['bunx', 'eslint']],
      ['deno', ['deno run', 'npm:eslint']],
      ['vlt', ['vlt x', 'eslint']],
    ] as const)('%s → %s', (pm, expected) => {
      expect(
        getRunCommandParts({
          packageName: 'eslint',
          packageManager: pm,
          jsrInfo: jsrNotAvailable,
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
})
