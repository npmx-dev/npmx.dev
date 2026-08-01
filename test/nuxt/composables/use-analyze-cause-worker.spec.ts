import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { until } from '@vueuse/core'
import { useAnalyzeCauseWorker } from '../../../app/composables/pkg-size/useAnalyzeCauseWorker'

vi.mock('~/composables/useNumberFormatter', () => ({
  useBytesFormatter: () => ({
    format: (v: number) => `${v} B`,
    t: (key: string) => key,
  }),
  useNumberFormatter: () =>
    computed(() => ({
      format: (v: number) => `${v}`,
    })),
}))

const mockWorker = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
}))

vi.mock('../../../app/utils/pkg-size/analyze-cause-client-worker', () => ({
  worker: mockWorker,
}))

function mountComposable(pkg = 'test-pkg', vTo = '2.0.0', vFrom = '1.0.0') {
  let composableResult: ReturnType<typeof useAnalyzeCauseWorker> | undefined

  const TestComponent = defineComponent({
    setup() {
      const packageName = computed(() => pkg)
      const version = computed(() => vTo)
      const comparedVersion = computed(() => vFrom)

      composableResult = useAnalyzeCauseWorker(packageName, version, comparedVersion)
      return () => {}
    },
  })

  const wrapper = mount(TestComponent)
  return { wrapper, result: composableResult! }
}

describe('useAnalyzeCauseWorker', () => {
  function getWorkerMessageHandler() {
    const call = mockWorker.addEventListener.mock.calls.find(c => c[0] === 'message')
    if (!call || typeof call[1] !== 'function') {
      throw new Error('Worker message handler not registered')
    }
    return call[1] as (event: unknown) => Promise<void>
  }

  function getWorkerPostMessageId() {
    const call = mockWorker.postMessage.mock.calls[0]
    if (!call || !call[0] || typeof call[0] !== 'object' || !('id' in call[0])) {
      throw new Error('Worker postMessage not called with expected payload')
    }
    return (call[0] as { id: string | number }).id
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize and load the worker correctly', async () => {
    const { result } = mountComposable()

    await until(result.loading).toBe(false, { timeout: 2000 })

    expect(result.loading.value).toBe(false)
    expect(result.available.value).toBe(true)
    expect(mockWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('should start analysis and send postMessage', async () => {
    const { result } = mountComposable()
    await until(result.loading).toBe(false, { timeout: 2000 })

    vi.useFakeTimers()

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    expect(result.analyzing.value).toBe(true)
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze-cause',
        packageName: 'test-pkg',
      }),
    )
  })

  it('should cancel analysis', async () => {
    const { result } = mountComposable()
    await until(result.loading).toBe(false, { timeout: 2000 })

    vi.useFakeTimers()

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    const cancelPromise = result.cancelAnalyzeCause()
    await vi.runAllTimersAsync()
    await cancelPromise

    expect(result.cancelling.value).toBe(true)
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'analyze-cause-abort',
      }),
    )
  })

  it('should handle successful result messages', async () => {
    const { result } = mountComposable()
    await until(result.loading).toBe(false, { timeout: 2000 })

    vi.useFakeTimers()

    const messageHandler = getWorkerMessageHandler()

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    const currentId = getWorkerPostMessageId()

    const handlerPromise = messageHandler({
      data: {
        id: currentId,
        type: 'result',
        result: [
          { name: 'dep-a', status: 'added', sizeDelta: 100, isOptional: false, v1: null, v2: null },
        ],
        summary: {
          sizeDelta: 100,
          mandatorySizeDelta: 100,
          netDependencies: 1,
          added: 1,
          removed: 0,
        },
      },
    })
    await vi.runAllTimersAsync()
    await handlerPromise

    expect(result.analyzing.value).toBe(false)
    expect(result.result.value).toHaveLength(1)
    expect(result.summary.value?.sizeDeltaText).toBe('100 B')
  })

  it('should handle worker error messages', async () => {
    const { result } = mountComposable()
    await until(result.loading).toBe(false, { timeout: 2000 })

    vi.useFakeTimers()

    const messageHandler = getWorkerMessageHandler()

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    const currentId = getWorkerPostMessageId()

    await messageHandler({
      data: { id: currentId, type: 'error', message: 'Something exploded' },
    })

    expect(result.error.value).toBe('Something exploded')
    expect(result.analyzing.value).toBe(false)
  })

  it('should clean up listeners on unmount', async () => {
    const { wrapper, result } = mountComposable()
    await until(result.loading).toBe(false, { timeout: 2000 })

    wrapper.unmount()

    expect(mockWorker.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockWorker.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function))
  })
})
