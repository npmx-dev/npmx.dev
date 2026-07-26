import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import 'fake-indexeddb/auto'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { resolveAndPersistGraph } from '../../app/utils/pkg-size/resolve-and-persist-graph'
import { db } from '../../app/utils/pkg-size/db'

const server = setupServer(
  http.get('https://registry.npmjs.org/:packageName', ({ params }) => {
    const { packageName } = params

    if (packageName === 'test-pkg' || packageName === '@scope/test-pkg') {
      return HttpResponse.json({
        'name': packageName,
        'dist-tags': { latest: '1.0.0' },
        'versions': {
          '1.0.0': {
            name: packageName,
            version: '1.0.0',
            dist: {
              unpackedSize: 1024,
              tarball: `https://registry.npmjs.org/${packageName}/-/${packageName}-1.0.0.tgz`,
            },
            dependencies: {
              'dep-child': '^1.0.0',
            },
            optionalDependencies: {
              'opt-child': '^2.0.0',
            },
          },
          'dep-child': {
            name: 'dep-child',
            version: '1.0.0',
            dist: { unpackedSize: 512, tarball: '' },
          },
          'opt-child': {
            name: 'opt-child',
            version: '2.0.0',
            dist: { unpackedSize: 256, tarball: '' },
          },
        },
      })
    }

    if (packageName === 'dep-child') {
      return HttpResponse.json({
        'name': 'dep-child',
        'dist-tags': { latest: '1.0.0' },
        'versions': {
          '1.0.0': {
            name: 'dep-child',
            version: '1.0.0',
            dist: { unpackedSize: 512, tarball: '' },
          },
        },
      })
    }

    if (packageName === 'opt-child') {
      return HttpResponse.json({
        'name': 'opt-child',
        'dist-tags': { latest: '2.0.0' },
        'versions': {
          '2.0.0': {
            name: 'opt-child',
            version: '2.0.0',
            dist: { unpackedSize: 256, tarball: '' },
          },
        },
      })
    }

    return new HttpResponse(null, { status: 404 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(async () => {
  server.resetHandlers()
  await db.dropDatabase()
})
afterAll(() => server.close())

describe('resolveAndPersistGraph', () => {
  it('should resolve metadata, process BFS queue, and persist session successfully', async () => {
    const controller = new AbortController()
    const rootKey = await resolveAndPersistGraph('test-pkg', '1.0.0', controller)

    expect(rootKey).toBe('test-pkg@1.0.0')

    const session = await db.getSession(rootKey)
    expect(session).toBeDefined()
    expect(session?.isFinished).toBe(true)
    expect(session?.totalSize).toBeGreaterThan(0)

    const pkgCount = await db.packages.count()
    expect(pkgCount).toBe(3)

    const depChild = await db.packages.get('dep-child@1.0.0')
    expect(depChild).toBeDefined()

    const optChild = await db.packages.get('opt-child@2.0.0')
    expect(optChild).toBeDefined()

    const edgesCount = await db.edges.count()
    expect(edgesCount).toBe(2)
  })

  it('should handle aborted requests gracefully', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(resolveAndPersistGraph('test-pkg', '1.0.0', controller)).rejects.toThrow(
      'pkg-size-aborted',
    )
  })
})
