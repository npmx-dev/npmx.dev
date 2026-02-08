import type { BundleResult, InitResult, ProgressMessage } from '~/bundler/types'
import { BundlerWorker } from '~/bundler/worker-client'
import { progress } from '~/bundler/events'

export interface BundleAnalyzerState {
  /** Initialization result (package info, subpaths, dependencies) */
  initResult: InitResult | null
  /** Current bundle result */
  bundleResult: BundleResult | null
  /** Loading/progress state */
  status: 'idle' | 'initializing' | 'bundling' | 'ready' | 'error'
  /** Progress details during init/bundle */
  progress: ProgressMessage | null
  /** Error if any */
  error: Error | null
}

/**
 * Composable for managing bundle size analysis using a Web Worker.
 * Client-side only - worker can't run on server.
 */
export function useBundleAnalyzer() {
  const state = reactive<BundleAnalyzerState>({
    initResult: null,
    bundleResult: null,
    status: 'idle',
    progress: null,
    error: null,
  })

  let worker: BundlerWorker | null = null
  let cleanupProgress: { off: () => void } | null = null

  /**
   * Initialize the analyzer with a package specifier.
   * Resolves dependencies, fetches tarballs, and prepares for bundling.
   */
  async function initPackage(packageSpec: string): Promise<InitResult> {
    // Cleanup previous session
    if (worker) {
      worker.terminate()
      worker = null
    }

    state.status = 'initializing'
    state.error = null
    state.bundleResult = null
    state.progress = null
    state.initResult = null

    // Listen to progress events
    cleanupProgress?.off()
    cleanupProgress = progress.on(msg => {
      state.progress = msg
    })

    try {
      worker = new BundlerWorker()
      const result = await worker.init(packageSpec)
      state.initResult = result
      state.status = 'ready'
      return result
    } catch (e) {
      state.error = e instanceof Error ? e : new Error(String(e))
      state.status = 'error'
      throw e
    }
  }

  /**
   * Bundle a subpath with optional export selection.
   * Must call initPackage first.
   */
  async function bundle(
    subpath: string,
    selectedExports: string[] | null = null,
  ): Promise<BundleResult> {
    if (!worker) {
      throw new Error('No session initialized - call initPackage first')
    }

    state.status = 'bundling'
    state.error = null

    try {
      const result = await worker.bundle(subpath, selectedExports)
      state.bundleResult = result
      state.status = 'ready'
      return result
    } catch (e) {
      state.error = e instanceof Error ? e : new Error(String(e))
      state.status = 'error'
      throw e
    }
  }

  /**
   * Cleanup the worker and reset state.
   */
  function cleanup() {
    if (worker) {
      worker.terminate()
      worker = null
    }
    cleanupProgress?.off()
    cleanupProgress = null
    state.initResult = null
    state.bundleResult = null
    state.status = 'idle'
    state.progress = null
    state.error = null
  }

  // Auto-cleanup on unmount
  if (import.meta.client) {
    onUnmounted(cleanup)
  }

  return {
    state: readonly(state),
    initPackage,
    bundle,
    cleanup,
  }
}
