import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'

vi.mock('~/utils/pkg-size/resolve-and-persist-graph', () => ({
  resolveAndPersistGraph: vi.fn().mockResolvedValue('mocked-key'),
}))

vi.mock('~/utils/pkg-size/db', () => ({
  db: {
    getSessions: vi.fn().mockResolvedValue([]),
    initSession: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockImplementation(key => ({
      rootKey: key,
      resolvedPackageKeys: ['dep-a@1.0.0'],
      optionalPackageKeys: [],
      totalSize: 1024,
      totalOptionalSize: 0,
      isFinished: true,
    })),
    packages: {
      where: vi.fn().mockReturnThis(),
      anyOf: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([
        {
          id: 'dep-a@1.0.0',
          name: 'dep-a',
          version: '1.0.0',
          unpackedSize: 1024,
          isOptional: false,
        },
      ]),
    },
  },
}))

const postMessageMock = vi.fn()
let messageHandler: (event: any) => Promise<void>

describe('analyze-cause-worker', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', {
      addEventListener: (event: string, handler: any) => {
        if (event === 'message') messageHandler = handler
      },
      postMessage: postMessageMock,
    })

    await import('../../app/utils/pkg-size/analyze-cause-worker')
  })

  beforeEach(() => {
    postMessageMock.mockClear()
    vi.clearAllMocks()
  })

  it('should handle analyze-cause-abort correctly', async () => {
    await messageHandler({
      data: { type: 'analyze-cause-abort', id: 'test-1' },
    })
    expect(postMessageMock).toHaveBeenCalledWith({ type: 'aborted', id: 'test-1' })
  })

  it('should process analyze-cause successfully', async () => {
    await messageHandler({
      data: {
        type: 'analyze-cause',
        id: 'test-2',
        packageName: 'vue',
        fromVersion: '3.4.0',
        toVersion: '3.5.0',
      },
    })

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sessions', id: 'test-2' }),
    )

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        id: 'test-2',
        summary: expect.any(Object),
      }),
    )
  })

  it('should ignore unknown message types (Line 34)', async () => {
    await messageHandler({ data: { type: 'random-unknown-type' } })
    expect(postMessageMock).not.toHaveBeenCalled()
  })

  it('should handle abort with mismatched id (Lines 25-26)', async () => {
    const pending = messageHandler({
      data: {
        type: 'analyze-cause',
        id: 'active-id',
        packageName: 'foo',
        fromVersion: '1',
        toVersion: '2',
      },
    })

    await messageHandler({ data: { type: 'analyze-cause-abort', id: 'wrong-id' } })

    expect(postMessageMock).toHaveBeenCalledWith({ type: 'aborted', id: 'wrong-id' })

    await pending
  })

  it('should handle generic errors in catch block (Lines 169-172)', async () => {
    const { resolveAndPersistGraph } =
      await import('../../app/utils/pkg-size/resolve-and-persist-graph')
    vi.mocked(resolveAndPersistGraph).mockRejectedValueOnce(new Error('Network explosion'))

    await messageHandler({
      data: {
        type: 'analyze-cause',
        id: 'error-id',
        packageName: 'foo',
        fromVersion: '1',
        toVersion: '2',
      },
    })

    expect(postMessageMock).toHaveBeenCalledWith({
      type: 'error',
      id: 'error-id',
      message: 'Network explosion',
    })
  })

  it('should handle missing sessions, removed packages, and flatMap merges (Lines 81, 110, 148, 189)', async () => {
    const { db } = await import('../../app/utils/pkg-size/db')

    vi.mocked(db.getSession).mockImplementation(async key => {
      if (key.includes('1.0.0')) {
        return {
          rootKey: key,
          resolvedPackageKeys: ['dep-a@1.0.0', 'dep-a@1.0.1'], // Diferente versión, mismo paquete para L189
          optionalPackageKeys: [],
          totalSize: 2000,
          isFinished: true,
        } as any
      }
      return undefined
    })

    vi.mocked(db.packages.toArray).mockResolvedValueOnce([
      {
        id: 'dep-a@1.0.0',
        name: 'dep-a',
        version: '1.0.0',
        unpackedSize: 1000,
        isOptional: false,
      } as any,
      {
        id: 'dep-a@1.0.1',
        name: 'dep-a',
        version: '1.0.1',
        unpackedSize: 1000,
        isOptional: false,
      } as any,
    ])

    await messageHandler({
      data: {
        type: 'analyze-cause',
        id: 'complex-id',
        packageName: 'foo',
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
      },
    })

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        summary: expect.objectContaining({ removed: 1 }),
      }),
    )
  })
})

describe('analyze-cause-client-worker', () => {
  it('should instantiate the Vite worker', async () => {
    const WorkerMock = vi.fn()
    vi.stubGlobal('Worker', WorkerMock)

    vi.doMock('~/utils/pkg-size/analyze-cause-worker?worker', () => ({
      default: WorkerMock,
    }))

    const { worker } = await import('../../app/utils/pkg-size/analyze-cause-client-worker')

    expect(WorkerMock).toHaveBeenCalledWith({
      name: 'NpmxPkgSizeAnalyzeCauseWorker',
    })
    expect(worker).toBeInstanceOf(WorkerMock)
  })
})
