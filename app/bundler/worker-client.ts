import * as v from 'valibot'
import { toRaw } from 'vue'

import { progress } from './events'
import {
  workerResponseSchema,
  type BundleOptions,
  type BundleResult,
  type InitOptions,
  type InitResult,
  type WorkerRequest,
} from './types'

export type { InitResult }

/**
 * a session for working with a package.
 * holds the worker and initialization result.
 */
export interface PackageSession extends InitResult {
  /** the worker instance for this session */
  worker: BundlerWorker
}

/**
 * client for communicating with a bundler worker.
 * each instance spawns a new worker, intended for one package.
 */
export class BundlerWorker {
  private worker: Worker
  private nextId = 0
  private pending = new Map<number, PromiseWithResolvers<unknown>>()
  private ready: Promise<void>
  private resolveReady!: () => void

  constructor() {
    this.ready = new Promise(resolve => {
      this.resolveReady = resolve
    })

    this.worker = new Worker(new URL('./lib/worker-entry.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', this.handleMessage.bind(this))
    this.worker.addEventListener('error', this.handleError.bind(this))
  }

  private handleMessage(event: MessageEvent<unknown>): void {
    const parsed = v.safeParse(workerResponseSchema, event.data)
    if (!parsed.success) {
      return
    }

    const response = parsed.output

    if (response.type === 'ready') {
      this.resolveReady()
      return
    }

    // forward progress messages to global emitter
    if (response.type === 'progress') {
      progress.trigger(response)
      return
    }

    const deferred = this.pending.get(response.id)
    if (!deferred) {
      // response for a request we no longer care about (e.g., superseded bundle)
      return
    }

    this.pending.delete(response.id)

    if (response.type === 'error') {
      deferred.reject(new Error(response.error))
    } else {
      deferred.resolve(response.result)
    }
  }

  private handleError(_event: ErrorEvent): void {
    // reject all pending requests
    for (const deferred of this.pending.values()) {
      deferred.reject(new Error('Worker error'))
    }
    this.pending.clear()
  }

  private async send<T>(message: WorkerRequest): Promise<T> {
    // wait for worker to be ready before sending
    await this.ready

    const deferred = Promise.withResolvers<T>()
    this.pending.set(message.id, deferred as PromiseWithResolvers<unknown>)
    this.worker.postMessage(message)
    return deferred.promise
  }

  /**
   * initializes the worker with a package.
   * only the first call does work; subsequent calls return cached result.
   */
  init(packageSpec: string, options?: InitOptions): Promise<InitResult> {
    return this.send<InitResult>({ id: this.nextId++, type: 'init', packageSpec, options })
  }

  /**
   * bundles a subpath from the initialized package.
   * uses "latest wins" - if called while a bundle is in progress,
   * the previous pending request is superseded.
   */
  bundle(
    subpath: string,
    selectedExports: string[] | null,
    options?: BundleOptions,
  ): Promise<BundleResult> {
    return this.send<BundleResult>({
      id: this.nextId++,
      type: 'bundle',
      subpath,
      // unwrap Vue reactive proxy - postMessage can't clone proxies
      selectedExports: selectedExports ? toRaw(selectedExports) : null,
      options,
    })
  }

  /**
   * terminates the worker.
   */
  terminate(): void {
    this.worker.terminate()
    for (const deferred of this.pending.values()) {
      deferred.reject(new DOMException('Worker terminated', 'AbortError'))
    }
    this.pending.clear()
  }
}
