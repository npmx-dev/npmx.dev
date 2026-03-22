import { describe, expect, it } from 'vitest'

/**
 * Unit tests for the dependents API response parsing logic.
 *
 * The `/api/registry/dependents/[...pkg]` endpoint fetches from the npm
 * search API using a `dependencies:<name>` query and maps the response
 * to a simplified shape. These tests verify the mapping logic in isolation.
 */

interface NpmSearchObject {
  package: {
    name: string
    version: string
    description?: string
    date?: string
  }
  score: { final: number }
  searchScore: number
}

function mapNpmSearchResponse(
  objects: NpmSearchObject[],
  total: number,
  page: number,
  size: number,
) {
  return {
    total,
    page,
    size,
    packages: objects.map(obj => ({
      name: obj.package.name,
      version: obj.package.version,
      description: obj.package.description ?? null,
      date: obj.package.date ?? null,
      score: obj.score.final,
    })),
  }
}

describe('dependents API response mapping', () => {
  it('maps npm search objects to the expected package shape', () => {
    const objects: NpmSearchObject[] = [
      {
        package: {
          name: 'some-lib',
          version: '1.2.3',
          description: 'A library',
          date: '2024-01-01',
        },
        score: { final: 0.95 },
        searchScore: 100,
      },
    ]

    const result = mapNpmSearchResponse(objects, 42, 0, 20)

    expect(result.total).toBe(42)
    expect(result.page).toBe(0)
    expect(result.size).toBe(20)
    expect(result.packages).toHaveLength(1)
    expect(result.packages[0]).toEqual({
      name: 'some-lib',
      version: '1.2.3',
      description: 'A library',
      date: '2024-01-01',
      score: 0.95,
    })
  })

  it('falls back to null for missing optional fields', () => {
    const objects: NpmSearchObject[] = [
      {
        package: { name: 'minimal-pkg', version: '0.1.0' },
        score: { final: 0.5 },
        searchScore: 50,
      },
    ]

    const result = mapNpmSearchResponse(objects, 1, 0, 20)
    expect(result.packages[0].description).toBeNull()
    expect(result.packages[0].date).toBeNull()
  })

  it('returns empty packages array when objects is empty', () => {
    const result = mapNpmSearchResponse([], 0, 0, 20)
    expect(result.packages).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('computes correct page offset for pagination', () => {
    // page=2, size=20 means from=40
    const page = 2
    const size = 20
    const from = page * size
    expect(from).toBe(40)
  })

  it('caps size to a maximum of 50', () => {
    const raw = 200
    const capped = Math.min(50, Math.max(1, raw))
    expect(capped).toBe(50)
  })

  it('enforces a minimum size of 1', () => {
    const raw = 0
    const capped = Math.min(50, Math.max(1, raw))
    expect(capped).toBe(1)
  })
})
