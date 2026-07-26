import type { ComputedRef } from 'vue'
import type {
  AnalyzeWorkerResponse,
  DiffResult,
  UIDiffResult,
  UISummary,
} from '~/utils/pkg-size/types'
import { shallowRef, onMounted, onUnmounted } from 'vue'
import { useThrottleFn } from '@vueuse/core'
import { useBytesFormatter, useNumberFormatter } from '~/composables/useNumberFormatter'

export function useAnalyzeCauseWorker(
  packageName: ComputedRef<string | undefined | null>,
  version: ComputedRef<string | undefined | null>,
  comparedVersion: ComputedRef<string | undefined | null>,
) {
  const analyzing = shallowRef(false)
  const available = shallowRef(false)
  const loading = shallowRef(true)
  const cancelling = shallowRef(false)
  const noResultScroll = shallowRef(false)
  const allDependencies = shallowRef(true)

  const rawResult = shallowRef<UIDiffResult[]>([])
  const result = computed(() => {
    const all = allDependencies.value
    const raw = rawResult.value
    if (all || raw.length === 0) {
      return raw
    }
    return raw.filter(v => !v.isOptional)
  })
  const summary = shallowRef<UISummary | undefined>()
  const error = shallowRef<string | undefined>()

  if (!import.meta.dev && import.meta.server) {
    return {
      available,
      analyzing,
      cancelling,
      loading,
      result,
      noResultScroll,
      allDependencies,
      summary,
      error,
      startAnalyzeCause: async () => {},
      cancelAnalyzeCause: async () => {},
    }
  }

  let worker: Worker | undefined
  let currentId: number | string = 0

  const bytesFormatter = useBytesFormatter()
  const rawBytesFormatter = useNumberFormatter()

  watch(
    [loading, packageName, version, comparedVersion],
    ([l, pkg, v1, v2]) => {
      available.value = !l && !!pkg && !!v1 && !!v2 && !!worker
    },
    { flush: 'post' },
  )

  function handleWorkerFailure(event: Event) {
    error.value = event instanceof ErrorEvent ? event.message : 'worker failure'
    analyzing.value = false
    cancelling.value = false
    // oxlint-disable-next-line no-console
    console.error('Worker failure:', event)
  }

  const startAnalyzeCause = useThrottleFn(
    async () => {
      if (!worker || !available.value || analyzing.value) {
        return
      }

      analyzing.value = true
      currentId =
        import.meta.test || import.meta.dev ? (currentId as number) + 1 : crypto.randomUUID()
      cancelling.value = false
      error.value = undefined
      summary.value = undefined
      rawResult.value = []

      await new Promise(resolve => setTimeout(resolve, 256))

      worker.postMessage({
        type: 'analyze-cause',
        id: currentId,
        packageName: packageName.value,
        fromVersion: comparedVersion.value,
        toVersion: version.value,
        ignoreOptional: false,
      })
    },
    256,
    false,
    true,
  )

  const cancelAnalyzeCause = useThrottleFn(
    async () => {
      if (!worker || !analyzing.value || cancelling.value) {
        return
      }

      cancelling.value = true

      await new Promise(resolve => setTimeout(resolve, 256))

      worker.postMessage({
        type: 'analyze-cause-abort',
        id: currentId,
      })
    },
    256,
    false,
    true,
  )

  function getDiffResultStatusText(diffResult: DiffResult): string {
    switch (diffResult.status) {
      case 'added':
        return bytesFormatter.t('package.size_increase.analyze.status.added')
      case 'changed':
        return bytesFormatter.t('package.size_increase.analyze.status.changed')
      case 'removed':
        return bytesFormatter.t('package.size_increase.analyze.status.removed')
      case 'unchanged':
        return bytesFormatter.t('package.size_increase.analyze.status.unchanged')
    }
  }

  async function handleWorkerMessage(event: MessageEvent<AnalyzeWorkerResponse>) {
    const msg = event.data

    if (msg.id !== currentId) {
      return
    }

    switch (msg.type) {
      case 'sessions':
        break
      case 'result':
        await new Promise(resolve => setTimeout(resolve, 1_000))
        rawResult.value = msg.result.map(
          r =>
            Object.assign(r, {
              v1: r.v1 ? { ...r.v1, sizeText: bytesFormatter.format(r.v1.size) } : null,
              v2: r.v2 ? { ...r.v2, sizeText: bytesFormatter.format(r.v2.size) } : null,
              statusText: getDiffResultStatusText(r),
              sizeDeltaText: bytesFormatter.format(r.sizeDelta),
            }) as UIDiffResult,
        )
        summary.value = Object.assign(msg.summary, {
          sizeDeltaText: bytesFormatter.format(msg.summary.sizeDelta),
          sizeDeltaBytesText: rawBytesFormatter.value.format(msg.summary.sizeDelta),
          mandatorySizeDeltaText: bytesFormatter.format(msg.summary.mandatorySizeDelta),
          mandatorySizeDeltaBytesText: rawBytesFormatter.value.format(
            msg.summary.mandatorySizeDelta,
          ),
          netDependenciesText: `${msg.summary.netDependencies > 0 ? '+' : ''}${rawBytesFormatter.value.format(msg.summary.netDependencies)}`,
          addedText: rawBytesFormatter.value.format(msg.summary.added),
          removedText: rawBytesFormatter.value.format(msg.summary.removed),
        })
        analyzing.value = false
        cancelling.value = false
        break
      case 'error':
        error.value = msg.message
        analyzing.value = false
        cancelling.value = false
        // oxlint-disable-next-line no-console
        console.error('Worker failure:', msg)
        break
      case 'aborting':
        cancelling.value = true
        break
      case 'aborted':
        analyzing.value = false
        cancelling.value = false
        break
    }
  }

  onMounted(async () => {
    try {
      const module = await import('~/utils/pkg-size/analyze-cause-client-worker')
      worker = module.worker

      worker.addEventListener('message', handleWorkerMessage)
      worker.addEventListener('error', handleWorkerFailure)
      worker.addEventListener('messageerror', handleWorkerFailure)
    } catch (err) {
      // oxlint-disable-next-line no-console
      console.error('cannot load worker', err)
      error.value =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String(err.message)
            : String(err)
    } finally {
      loading.value = false
    }
  })

  onUnmounted(() => {
    if (worker) {
      // send abort first, then remove listeners: the aborting message won't be received here (fire and forgot)
      if (analyzing.value) {
        worker.postMessage({ type: 'analyze-cause-abort', id: currentId })
      }
      worker.removeEventListener('message', handleWorkerMessage)
      worker.removeEventListener('error', handleWorkerFailure)
      worker.removeEventListener('messageerror', handleWorkerFailure)
    }
  })

  return {
    available,
    analyzing,
    cancelling,
    loading,
    result,
    noResultScroll,
    allDependencies,
    summary,
    error,
    startAnalyzeCause,
    cancelAnalyzeCause,
  }
}
