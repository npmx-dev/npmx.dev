import { describe, expect, it } from 'vitest'
import {
  isNonRegistryRange,
  parsePackageJsonDependencies,
  parsePackageJsonText,
  resolveNpmAlias,
} from '~/utils/parse-package-json-deps'

describe('parse-package-json-deps', () => {
  describe('isNonRegistryRange', () => {
    it('detects local and remote protocols', () => {
      expect(isNonRegistryRange('file:../local')).toBe(true)
      expect(isNonRegistryRange('workspace:*')).toBe(true)
      expect(isNonRegistryRange('link:./pkg')).toBe(true)
      expect(isNonRegistryRange('git+https://github.com/org/repo.git')).toBe(true)
      expect(isNonRegistryRange('https://example.com/pkg.tgz')).toBe(true)
      expect(isNonRegistryRange('^1.2.3')).toBe(false)
      expect(isNonRegistryRange('*')).toBe(false)
    })
  })

  describe('resolveNpmAlias', () => {
    it('resolves unscoped and scoped npm aliases', () => {
      expect(resolveNpmAlias('npm:lodash@4.17.21')).toEqual({
        packageName: 'lodash',
        range: '4.17.21',
      })
      expect(resolveNpmAlias('npm:@scope/pkg@^1.0.0')).toEqual({
        packageName: '@scope/pkg',
        range: '^1.0.0',
      })
      expect(resolveNpmAlias('^1.0.0')).toBeNull()
    })
  })

  describe('parsePackageJsonDependencies', () => {
    it('parses dependency groups in order', () => {
      const result = parsePackageJsonDependencies({
        name: 'demo',
        version: '1.0.0',
        dependencies: { vue: '^3.5.0', react: '^19.0.0' },
        devDependencies: { vitest: '^3.0.0' },
        peerDependencies: { typescript: '>=5' },
        optionalDependencies: { fsevents: '^2.3.0' },
      })

      expect(result.name).toBe('demo')
      expect(result.dependencies.map(d => `${d.category}:${d.name}`)).toEqual([
        'dependencies:react',
        'dependencies:vue',
        'devDependencies:vitest',
        'peerDependencies:typescript',
        'optionalDependencies:fsevents',
      ])
    })

    it('resolves npm aliases and marks non-registry ranges', () => {
      const result = parsePackageJsonDependencies({
        dependencies: {
          alias: 'npm:lodash@^4.17.21',
          local: 'file:../pkg',
        },
      })

      expect(result.dependencies).toEqual([
        {
          name: 'alias',
          range: '^4.17.21',
          packageName: 'lodash',
          category: 'dependencies',
          nonRegistry: false,
        },
        {
          name: 'local',
          range: 'file:../pkg',
          packageName: 'local',
          category: 'dependencies',
          nonRegistry: true,
        },
      ])
    })

    it('throws for non-object JSON roots', () => {
      expect(() => parsePackageJsonDependencies([])).toThrow(/expected a JSON object/)
      expect(() => parsePackageJsonText('{')).toThrow(/could not parse JSON/)
    })
  })
})
