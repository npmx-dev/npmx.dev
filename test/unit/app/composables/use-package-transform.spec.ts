import { describe, expect, it } from 'vitest'
import { transformPackument } from '../../../../app/composables/npm/usePackage'

function createVersion(version: string) {
  return {
    _npmVersion: '10.0.0',
    _id: `foo@${version}`,
    name: 'foo',
    version,
    dependencies: {
      bar: '^1.0.0',
    },
    dist: {
      shasum: version,
      tarball: `https://registry.npmjs.org/foo/-/foo-${version}.tgz`,
      signatures: [],
    },
  }
}

function createPackument(
  versions: Packument['versions'],
  time: Packument['time'],
  latest: string,
): Packument {
  return {
    '_rev': '1',
    '_id': 'foo',
    'name': 'foo',
    'description': 'A test package',
    'dist-tags': { latest },
    time,
    versions,
    'maintainers': [],
    'author': { name: 'test' },
    'license': 'MIT',
    'homepage': '',
    'keywords': [],
    'repository': { type: 'git', url: 'https://github.com/foo/foo' },
    'bugs': { url: '' },
    'readme': '',
  }
}

describe('transformPackument', () => {
  it('resolves latest dist-tag version when requestedVersion is null, undefined, or a dist-tag', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0'),
        '1.0.1': createVersion('1.0.1'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-02T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
      },
      '1.0.1',
    )

    const transformedNull = transformPackument(packument, null)
    expect(transformedNull.requestedVersion?.version).toBe('1.0.1')
    expect(transformedNull.requestedVersion?.dependencies).toEqual({ bar: '^1.0.0' })

    const transformedUndefined = transformPackument(packument, undefined)
    expect(transformedUndefined.requestedVersion?.version).toBe('1.0.1')
    expect(transformedUndefined.requestedVersion?.dependencies).toEqual({ bar: '^1.0.0' })

    const transformedTag = transformPackument(packument, 'latest')
    expect(transformedTag.requestedVersion?.version).toBe('1.0.1')
    expect(transformedTag.requestedVersion?.dependencies).toEqual({ bar: '^1.0.0' })
  })

  it('uses specific requestedVersion when provided and available', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0'),
        '1.0.1': createVersion('1.0.1'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-02T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
      },
      '1.0.1',
    )

    const transformed = transformPackument(packument, '1.0.0')
    expect(transformed.requestedVersion?.version).toBe('1.0.0')
  })
})
