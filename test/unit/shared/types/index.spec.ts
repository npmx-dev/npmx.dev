import { describe, expect, it } from 'vitest'
import type { NpmPackage, NpmSearchResponse } from '../../../../shared/types'

describe('npm registry types', () => {
  it('should correctly type a package response', () => {
    const pkg: NpmPackage = {
      '_id': 'test-package',
      '_rev': '1-abc123',
      'name': 'test-package',
      'description': 'A test package',
      'dist-tags': { latest: '1.0.0' },
      'versions': {
        '1.0.0': {
          name: 'test-package',
          version: '1.0.0',
          _id: 'test-package@1.0.0',
          _npmVersion: '10.0.0',
          dist: {
            shasum: 'abc123',
            tarball: 'https://registry.npmjs.org/test-package/-/test-package-1.0.0.tgz',
            signatures: [],
          },
        },
      },
      'time': {
        'created': '2024-01-01T00:00:00.000Z',
        'modified': '2024-01-02T00:00:00.000Z',
        '1.0.0': '2024-01-01T00:00:00.000Z',
      },
    }

    expect(pkg.name).toBe('test-package')
    expect(pkg['dist-tags'].latest).toBe('1.0.0')
    expect(pkg.versions['1.0.0']?.version).toBe('1.0.0')
  })

  it('should correctly type a search response', () => {
    const response: NpmSearchResponse = {
      objects: [
        {
          package: {
            name: 'test-package',
            version: '1.0.0',
            date: '2024-01-01T00:00:00.000Z',
            links: {
              npm: 'https://www.npmjs.com/package/test-package',
            },
          },
          score: {
            final: 0.9,
            detail: {
              quality: 0.9,
              popularity: 0.8,
              maintenance: 0.95,
            },
          },
          searchScore: 100000,
        },
      ],
      total: 1,
      time: '2024-01-01T00:00:00.000Z',
    }

    expect(response.total).toBe(1)
    expect(response.objects[0]?.package.name).toBe('test-package')
    expect(response.objects[0]?.score.final).toBe(0.9)
  })
})
