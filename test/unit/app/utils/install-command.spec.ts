import { describe, expect, it } from 'vitest'
import {
  getInstallCommand,
  getInstallCommandParts,
  getPackageSpecifier,
  getExecuteCommand,
  getExecuteCommandParts,
} from '../../../../app/utils/install-command'
import type { JsrPackageInfo } from '../../../../shared/types/jsr'

describe('install command generation', () => {
  // Test fixtures
  const unscopedPackage = 'lodash'
  const scopedPackage = '@trpc/server'

  const jsrAvailable: JsrPackageInfo = {
    exists: true,
    scope: 'trpc',
    name: 'server',
    url: 'https://jsr.io/@trpc/server',
    latestVersion: '10.0.0',
  }

  const jsrNotAvailable: JsrPackageInfo = {
    exists: false,
  }

  describe('getPackageSpecifier', () => {
    describe('unscoped package (lodash) - not on JSR', () => {
      it.each([
        ['npm', 'lodash'],
        ['pnpm', 'lodash'],
        ['yarn', 'lodash'],
        ['bun', 'lodash'],
        ['deno', 'npm:lodash'],
        ['vlt', 'lodash'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getPackageSpecifier({
            packageName: unscopedPackage,
            packageManager: pm,
            jsrInfo: jsrNotAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('scoped package (@trpc/server) - available on JSR', () => {
      it.each([
        ['npm', '@trpc/server'],
        ['pnpm', '@trpc/server'],
        ['yarn', '@trpc/server'],
        ['bun', '@trpc/server'],
        ['deno', 'jsr:@trpc/server'], // Native JSR specifier preferred
        ['vlt', '@trpc/server'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getPackageSpecifier({
            packageName: scopedPackage,
            packageManager: pm,
            jsrInfo: jsrAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('scoped package (@vue/shared) - NOT on JSR', () => {
      it.each([
        ['npm', '@vue/shared'],
        ['pnpm', '@vue/shared'],
        ['yarn', '@vue/shared'],
        ['bun', '@vue/shared'],
        ['deno', 'npm:@vue/shared'], // Falls back to npm: compat
        ['vlt', '@vue/shared'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getPackageSpecifier({
            packageName: '@vue/shared',
            packageManager: pm,
            jsrInfo: jsrNotAvailable,
          }),
        ).toBe(expected)
      })
    })
  })

  describe('getInstallCommand', () => {
    describe('unscoped package without version', () => {
      it.each([
        ['npm', 'npm install lodash'],
        ['pnpm', 'pnpm add lodash'],
        ['yarn', 'yarn add lodash'],
        ['bun', 'bun add lodash'],
        ['deno', 'deno add npm:lodash'],
        ['vlt', 'vlt install lodash'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getInstallCommand({
            packageName: unscopedPackage,
            packageManager: pm,
            jsrInfo: jsrNotAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('unscoped package with version', () => {
      it.each([
        ['npm', 'npm install lodash@4.17.21'],
        ['pnpm', 'pnpm add lodash@4.17.21'],
        ['yarn', 'yarn add lodash@4.17.21'],
        ['bun', 'bun add lodash@4.17.21'],
        ['deno', 'deno add npm:lodash@4.17.21'],
        ['vlt', 'vlt install lodash@4.17.21'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getInstallCommand({
            packageName: unscopedPackage,
            packageManager: pm,
            version: '4.17.21',
            jsrInfo: jsrNotAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('scoped package on JSR without version', () => {
      it.each([
        ['npm', 'npm install @trpc/server'],
        ['pnpm', 'pnpm add @trpc/server'],
        ['yarn', 'yarn add @trpc/server'],
        ['bun', 'bun add @trpc/server'],
        ['deno', 'deno add jsr:@trpc/server'], // Native JSR preferred
        ['vlt', 'vlt install @trpc/server'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getInstallCommand({
            packageName: scopedPackage,
            packageManager: pm,
            jsrInfo: jsrAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('scoped package on JSR with version', () => {
      it.each([
        ['npm', 'npm install @trpc/server@10.0.0'],
        ['pnpm', 'pnpm add @trpc/server@10.0.0'],
        ['yarn', 'yarn add @trpc/server@10.0.0'],
        ['bun', 'bun add @trpc/server@10.0.0'],
        ['deno', 'deno add jsr:@trpc/server@10.0.0'], // Native JSR with version
        ['vlt', 'vlt install @trpc/server@10.0.0'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getInstallCommand({
            packageName: scopedPackage,
            packageManager: pm,
            version: '10.0.0',
            jsrInfo: jsrAvailable,
          }),
        ).toBe(expected)
      })
    })

    describe('scoped package NOT on JSR', () => {
      it.each([
        ['npm', 'npm install @vue/shared'],
        ['pnpm', 'pnpm add @vue/shared'],
        ['yarn', 'yarn add @vue/shared'],
        ['bun', 'bun add @vue/shared'],
        ['deno', 'deno add npm:@vue/shared'], // Falls back to npm: compat
        ['vlt', 'vlt install @vue/shared'],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getInstallCommand({
            packageName: '@vue/shared',
            packageManager: pm,
            jsrInfo: jsrNotAvailable,
          }),
        ).toBe(expected)
      })
    })
  })

  describe('getInstallCommandParts', () => {
    it('returns correct parts for npm without version', () => {
      const parts = getInstallCommandParts({
        packageName: 'lodash',
        packageManager: 'npm',
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual(['npm', 'install', 'lodash'])
    })

    it('returns correct parts for npm with version', () => {
      const parts = getInstallCommandParts({
        packageName: 'lodash',
        packageManager: 'npm',
        version: '4.17.21',
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual(['npm', 'install', 'lodash@4.17.21'])
    })

    it('returns correct parts for deno with jsr: prefix when available', () => {
      const parts = getInstallCommandParts({
        packageName: '@trpc/server',
        packageManager: 'deno',
        jsrInfo: jsrAvailable,
      })
      expect(parts).toEqual(['deno', 'add', 'jsr:@trpc/server'])
    })

    it('returns correct parts for deno with npm: prefix when not on JSR', () => {
      const parts = getInstallCommandParts({
        packageName: 'lodash',
        packageManager: 'deno',
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual(['deno', 'add', 'npm:lodash'])
    })

    it('returns correct parts for vlt', () => {
      const parts = getInstallCommandParts({
        packageName: 'lodash',
        packageManager: 'vlt',
        jsrInfo: jsrNotAvailable,
      })
      expect(parts).toEqual(['vlt', 'install', 'lodash'])
    })

    it('joined parts match getInstallCommand output', () => {
      const options = {
        packageName: '@trpc/server',
        packageManager: 'pnpm' as const,
        version: '10.0.0',
        jsrInfo: jsrAvailable,
      }
      const parts = getInstallCommandParts(options)
      const command = getInstallCommand(options)
      expect(parts.join(' ')).toBe(command)
    })
  })

  describe('edge cases', () => {
    it('handles null jsrInfo same as not available for deno', () => {
      expect(
        getPackageSpecifier({
          packageName: 'lodash',
          packageManager: 'deno',
          jsrInfo: null,
        }),
      ).toBe('npm:lodash')
    })

    it('handles undefined jsrInfo same as not available for deno', () => {
      expect(
        getPackageSpecifier({
          packageName: 'lodash',
          packageManager: 'deno',
          jsrInfo: undefined,
        }),
      ).toBe('npm:lodash')
    })

    it('handles jsrInfo with exists:true but missing scope/name for deno', () => {
      const partialJsr: JsrPackageInfo = {
        exists: true,
        // Missing scope and name
      }
      expect(
        getPackageSpecifier({
          packageName: '@foo/bar',
          packageManager: 'deno',
          jsrInfo: partialJsr,
        }),
      ).toBe('npm:@foo/bar')
    })

    it('getInstallCommandParts returns empty array for invalid package manager', () => {
      const parts = getInstallCommandParts({
        packageName: 'lodash',
        packageManager: 'invalid' as any,
      })
      expect(parts).toEqual([])
    })
  })

  describe('getExecuteCommandParts', () => {
    describe('local execute (isBinaryOnly: false)', () => {
      it.each([
        ['npm', ['npx', 'eslint']],
        ['pnpm', ['pnpm', 'exec', 'eslint']],
        ['yarn', ['yarn', 'eslint']],
        ['bun', ['bunx', 'eslint']],
        ['deno', ['deno', 'run', 'npm:eslint']],
        ['vlt', ['vlt', 'x', 'eslint']],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getExecuteCommandParts({
            packageName: 'eslint',
            packageManager: pm,
            isBinaryOnly: false,
          }),
        ).toEqual(expected)
      })
    })

    describe('remote execute (isBinaryOnly: true)', () => {
      it.each([
        ['npm', ['npx', 'degit']],
        ['pnpm', ['pnpm', 'dlx', 'degit']],
        ['yarn', ['yarn', 'dlx', 'degit']],
        ['bun', ['bunx', 'degit']],
        ['deno', ['deno', 'run', 'npm:degit']],
        ['vlt', ['vlt', 'x', 'degit']],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getExecuteCommandParts({
            packageName: 'degit',
            packageManager: pm,
            isBinaryOnly: true,
          }),
        ).toEqual(expected)
      })
    })

    describe('create-* packages (isCreatePackage: true)', () => {
      it.each([
        ['npm', ['npm', 'create', 'vite']],
        ['pnpm', ['pnpm', 'create', 'vite']],
        ['yarn', ['yarn', 'create', 'vite']],
        ['bun', ['bun', 'create', 'vite']],
        ['deno', ['deno', 'run', 'vite']],
        ['vlt', ['vlt', 'x', 'vite']],
      ] as const)('%s → %s', (pm, expected) => {
        expect(
          getExecuteCommandParts({
            packageName: 'create-vite',
            packageManager: pm,
            isCreatePackage: true,
          }),
        ).toEqual(expected)
      })
    })

    describe('scoped create-* packages', () => {
      it('handles @scope/create-app pattern', () => {
        expect(
          getExecuteCommandParts({
            packageName: '@vue/create-app',
            packageManager: 'npm',
            isCreatePackage: true,
          }),
        ).toEqual(['npm', 'create', 'app'])
      })
    })
  })

  describe('getExecuteCommand', () => {
    it('generates full execute command string for local execute', () => {
      expect(
        getExecuteCommand({
          packageName: 'eslint',
          packageManager: 'pnpm',
          isBinaryOnly: false,
        }),
      ).toBe('pnpm exec eslint')
    })

    it('generates full execute command string for remote execute', () => {
      expect(
        getExecuteCommand({
          packageName: 'degit',
          packageManager: 'pnpm',
          isBinaryOnly: true,
        }),
      ).toBe('pnpm dlx degit')
    })

    it('generates create command for create-* packages', () => {
      expect(
        getExecuteCommand({
          packageName: 'create-vite',
          packageManager: 'pnpm',
          isCreatePackage: true,
        }),
      ).toBe('pnpm create vite')
    })
  })
})
