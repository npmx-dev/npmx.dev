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

const mockWorker = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  postMessage: vi.fn(),
}

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

    const messageHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message',
    )![1]

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    const currentId = mockWorker.postMessage.mock.calls[0]![0].id

    const mockMsg = {
      data: {
        id: currentId,
        type: 'result',
        result: [{ name: 'dep-a', status: 'added', sizeDelta: 100, isOptional: false }],
        summary: {
          sizeDelta: 100,
          mandatorySizeDelta: 100,
          netDependencies: 1,
          added: 1,
          removed: 0,
        },
      },
    }

    const handlerPromise = messageHandler(mockMsg as any)
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

    const messageHandler = mockWorker.addEventListener.mock.calls.find(
      call => call[0] === 'message',
    )![1]

    const startPromise = result.startAnalyzeCause()
    await vi.runAllTimersAsync()
    await startPromise

    const currentId = mockWorker.postMessage.mock.calls[0]![0].id

    await messageHandler({
      data: { id: currentId, type: 'error', message: 'Something exploded' },
    } as any)

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
