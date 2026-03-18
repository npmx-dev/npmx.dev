import { describe, expect, it } from 'vitest'
import {
  extractInstallScriptsInfo,
  getInstallScriptFilePath,
  parseNodeScript,
} from '../../../../app/utils/install-scripts'

describe('extractInstallScriptsInfo', () => {
  it('returns null when no install scripts exist', () => {
    expect(extractInstallScriptsInfo(undefined)).toBeNull()
    expect(extractInstallScriptsInfo({})).toBeNull()
    expect(extractInstallScriptsInfo({ build: 'vite build', test: 'vitest' })).toBeNull()
  })

  it('detects all install script types with content', () => {
    const scripts = {
      preinstall: 'node check.js',
      install: 'node-gyp rebuild',
      postinstall: 'node setup.js',
      build: 'vite build', // should be ignored
    }
    const result = extractInstallScriptsInfo(scripts)
    expect(result).toEqual({
      scripts: ['preinstall', 'install', 'postinstall'],
      content: {
        preinstall: 'node check.js',
        install: 'node-gyp rebuild',
        postinstall: 'node setup.js',
      },
      npxDependencies: {},
    })
  })

  it('extracts npx packages with versions and flags', () => {
    const scripts = {
      preinstall: 'npx only-allow pnpm',
      postinstall: 'npx -y prisma@5.0.0 generate && npx --yes @scope/pkg db push',
    }
    const result = extractInstallScriptsInfo(scripts)
    expect(result).toEqual({
      scripts: ['preinstall', 'postinstall'],
      content: {
        preinstall: 'npx only-allow pnpm',
        postinstall: 'npx -y prisma@5.0.0 generate && npx --yes @scope/pkg db push',
      },
      npxDependencies: {
        'only-allow': 'latest',
        'prisma': '5.0.0',
        '@scope/pkg': 'latest',
      },
    })
  })

  it('ignores npx in non-install scripts and built-in commands', () => {
    const scripts = {
      prepare: 'npx husky install', // ignored - not install script
      postinstall: 'npx node script.js', // node is filtered as builtin
    }
    const result = extractInstallScriptsInfo(scripts)
    expect(result).toEqual({
      scripts: ['postinstall'],
      content: { postinstall: 'npx node script.js' },
      npxDependencies: {},
    })
  })

  it('extracts npx packages with dots in names', () => {
    const scripts = {
      postinstall: 'npx vue.js@3.0.0 && npx @scope/pkg.name generate',
    }
    const result = extractInstallScriptsInfo(scripts)
    expect(result).toEqual({
      scripts: ['postinstall'],
      content: { postinstall: 'npx vue.js@3.0.0 && npx @scope/pkg.name generate' },
      npxDependencies: {
        'vue.js': '3.0.0',
        '@scope/pkg.name': 'latest',
      },
    })
  })
})

describe('getInstallScriptFilePath', () => {
  it('returns file path when script is `node <file-path>`', () => {
    expect(getInstallScriptFilePath('node scripts/postinstall.js')).toBe('scripts/postinstall.js')
  })

  it('returns package.json when script is not a simple node command', () => {
    expect(getInstallScriptFilePath('npx prisma generate')).toBe('package.json')
  })

  it('strips leading ./ from relative paths', () => {
    expect(getInstallScriptFilePath('node ./scripts/setup.js')).toBe('scripts/setup.js')
  })

  it('falls back to package.json for parent directory references', () => {
    expect(getInstallScriptFilePath('node ../scripts/setup.js')).toBe('package.json')
    expect(getInstallScriptFilePath('node ./scripts/../lib/setup.js')).toBe('package.json')
  })

  it('returns package.json for bare node command without arguments', () => {
    expect(getInstallScriptFilePath('node')).toBe('package.json')
    expect(getInstallScriptFilePath('node ')).toBe('package.json')
  })
})

describe('parseNodeScript', () => {
  it('returns prefix and filePath for node scripts', () => {
    expect(parseNodeScript('node scripts/postinstall.js')).toEqual({
      prefix: 'node ',
      filePath: 'scripts/postinstall.js',
    })
  })

  it('strips leading ./ from file path', () => {
    expect(parseNodeScript('node ./scripts/setup.js')).toEqual({
      prefix: 'node ',
      filePath: 'scripts/setup.js',
    })
  })

  it('returns null for non-node scripts', () => {
    expect(parseNodeScript('npx prisma generate')).toBeNull()
  })

  it('returns null for bare node command', () => {
    expect(parseNodeScript('node')).toBeNull()
    expect(parseNodeScript('node ')).toBeNull()
  })

  it('returns null for parent directory references', () => {
    expect(parseNodeScript('node ../scripts/setup.js')).toBeNull()
  })
})
