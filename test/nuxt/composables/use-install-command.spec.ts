import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JsrPackageInfo } from '#shared/types/jsr'

describe('useInstallCommand', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('basic install commands', () => {
    it('should generate npm install command by default', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      expect(selectedPM.value).toBe('npm')
      expect(installCommand.value).toBe('npm install vue')
      expect(installCommandParts.value).toEqual(['npm', 'install', 'vue'])
    })

    it('should include version when specified', () => {
      const { installCommand, installCommandParts } = useInstallCommand('vue', '3.5.0', null, null)

      expect(installCommand.value).toBe('npm install vue@3.5.0')
      expect(installCommandParts.value).toEqual(['npm', 'install', 'vue@3.5.0'])
    })

    it('should handle scoped packages', () => {
      const { installCommand, installCommandParts } = useInstallCommand(
        '@nuxt/kit',
        null,
        null,
        null,
      )

      expect(installCommand.value).toBe('npm install @nuxt/kit')
      expect(installCommandParts.value).toEqual(['npm', 'install', '@nuxt/kit'])
    })

    it('should handle null packageName', () => {
      const { installCommand, installCommandParts } = useInstallCommand(null, null, null, null)

      expect(installCommand.value).toBe('')
      expect(installCommandParts.value).toEqual([])
    })
  })

  describe('package manager selection', () => {
    it('should use pnpm when selected', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      selectedPM.value = 'pnpm'
      expect(installCommand.value).toBe('pnpm add vue')
      expect(installCommandParts.value).toEqual(['pnpm', 'add', 'vue'])
    })

    it('should use yarn when selected', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      selectedPM.value = 'yarn'
      expect(installCommand.value).toBe('yarn add vue')
      expect(installCommandParts.value).toEqual(['yarn', 'add', 'vue'])
    })

    it('should use bun when selected', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      selectedPM.value = 'bun'
      expect(installCommand.value).toBe('bun add vue')
      expect(installCommandParts.value).toEqual(['bun', 'add', 'vue'])
    })

    it('should use deno with npm: prefix when selected', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      selectedPM.value = 'deno'
      expect(installCommand.value).toBe('deno add npm:vue')
      expect(installCommandParts.value).toEqual(['deno', 'add', 'npm:vue'])
    })

    it('should use vlt when selected', () => {
      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      selectedPM.value = 'vlt'
      expect(installCommand.value).toBe('vlt install vue')
      expect(installCommandParts.value).toEqual(['vlt', 'install', 'vue'])
    })
  })

  describe('deno with JSR', () => {
    it('should use jsr: prefix when package exists on JSR', () => {
      const jsrInfo: JsrPackageInfo = {
        exists: true,
        scope: 'std',
        name: 'path',
        url: 'https://jsr.io/@std/path',
      }

      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        '@std/path',
        null,
        jsrInfo,
        null,
      )

      selectedPM.value = 'deno'
      expect(installCommand.value).toBe('deno add jsr:@std/path')
      expect(installCommandParts.value).toEqual(['deno', 'add', 'jsr:@std/path'])
    })

    it('should use npm: prefix for deno when package is not on JSR', () => {
      const jsrInfo: JsrPackageInfo = { exists: false }

      const { installCommand, installCommandParts, selectedPM } = useInstallCommand(
        'lodash',
        null,
        jsrInfo,
        null,
      )

      selectedPM.value = 'deno'
      expect(installCommand.value).toBe('deno add npm:lodash')
      expect(installCommandParts.value).toEqual(['deno', 'add', 'npm:lodash'])
    })
  })

  describe('@types packages', () => {
    it('should generate @types install command parts', () => {
      const { typesInstallCommandParts, showTypesInInstall } = useInstallCommand(
        'express',
        null,
        null,
        '@types/express',
      )

      expect(showTypesInInstall.value).toBe(true)
      expect(typesInstallCommandParts.value).toEqual(['npm', 'install', '-D', '@types/express'])
    })

    it('should use -d flag for bun', () => {
      const { typesInstallCommandParts, selectedPM } = useInstallCommand(
        'express',
        null,
        null,
        '@types/express',
      )

      selectedPM.value = 'bun'
      expect(typesInstallCommandParts.value).toEqual(['bun', 'add', '-d', '@types/express'])
    })

    it('should use npm: prefix for deno @types', () => {
      const { typesInstallCommandParts, selectedPM } = useInstallCommand(
        'express',
        null,
        null,
        '@types/express',
      )

      selectedPM.value = 'deno'
      expect(typesInstallCommandParts.value).toEqual(['deno', 'add', '-D', 'npm:@types/express'])
    })

    it('should not show @types when typesPackageName is null', () => {
      const { showTypesInInstall, typesInstallCommandParts } = useInstallCommand(
        'express',
        null,
        null,
        null,
      )

      expect(showTypesInInstall.value).toBe(false)
      expect(typesInstallCommandParts.value).toEqual([])
    })
  })

  describe('fullInstallCommand with @types', () => {
    it('should include both commands when @types enabled', () => {
      const { fullInstallCommand } = useInstallCommand('express', null, null, '@types/express')

      expect(fullInstallCommand.value).toBe('npm install express; npm install -D @types/express')
    })

    it('should only include main command when @types disabled via settings', () => {
      // Get settings and disable includeTypesInInstall directly
      const { settings } = useSettings()
      settings.value.includeTypesInInstall = false

      const { fullInstallCommand, showTypesInInstall } = useInstallCommand(
        'express',
        null,
        null,
        '@types/express',
      )

      expect(showTypesInInstall.value).toBe(false)
      expect(fullInstallCommand.value).toBe('npm install express')
    })
  })

  describe('reactive updates', () => {
    it('should update command when package manager changes', () => {
      const { installCommand, selectedPM } = useInstallCommand('vue', null, null, null)

      expect(installCommand.value).toBe('npm install vue')

      selectedPM.value = 'pnpm'
      expect(installCommand.value).toBe('pnpm add vue')

      selectedPM.value = 'yarn'
      expect(installCommand.value).toBe('yarn add vue')
    })

    it('should update when using ref values', () => {
      const packageName = ref<string | null>('vue')
      const version = ref<string | null>(null)

      const { installCommand } = useInstallCommand(packageName, version, null, null)

      expect(installCommand.value).toBe('npm install vue')

      packageName.value = 'react'
      expect(installCommand.value).toBe('npm install react')

      version.value = '18.2.0'
      expect(installCommand.value).toBe('npm install react@18.2.0')
    })
  })

  describe('copyInstallCommand', () => {
    it('should copy command to clipboard and set copied state', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      const { copyInstallCommand, copied, fullInstallCommand } = useInstallCommand(
        'vue',
        null,
        null,
        null,
      )

      expect(copied.value).toBe(false)
      await copyInstallCommand()

      expect(writeText).toHaveBeenCalledWith(fullInstallCommand.value)
      expect(copied.value).toBe(true)

      // Wait for the timeout to reset copied
      await new Promise(resolve => setTimeout(resolve, 2100))
      expect(copied.value).toBe(false)
    })

    it('should not copy when command is empty', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText } })

      const { copyInstallCommand, copied } = useInstallCommand(null, null, null, null)

      await copyInstallCommand()

      expect(writeText).not.toHaveBeenCalled()
      expect(copied.value).toBe(false)
    })
  })
})
