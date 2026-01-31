import { describe, expect, it } from 'vitest'
import { extractInstallScriptsInfo } from '../../../../app/utils/install-scripts'

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
