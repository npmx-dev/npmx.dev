/* eslint-disable unicorn/require-post-message-target-origin -- Worker.postMessage doesn't take targetOrigin */
import * as v from 'valibot'

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
 * client for communicating with a bundler worker.
 * each instance spawns a new worker, intended for one package.
 */
export class BundlerWorker {
  private worker: Worker
  private nextId = 0
  private latestBundleId: number | null = null
  private pending = new Map<number, PromiseWithResolvers<unknown>>()
  private ready: Promise<void>
  private resolveReady!: () => void
  private rejectReady!: (error: Error) => void

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })

    this.worker = new Worker(new URL('./lib/worker-entry.ts', import.meta.url), { type: 'module' })
    this.worker.addEventListener('message', this.handleMessage.bind(this))
    this.worker.addEventListener('error', this.handleError.bind(this))
  }

  private handleMessage(event: MessageEvent<unknown>): void {
    // check for ready signal
    if (
      event.data &&
      typeof event.data === 'object' &&
      'type' in event.data &&
      event.data.type === 'ready'
    ) {
      this.resolveReady()
      return
    }

    const parsed = v.safeParse(workerResponseSchema, event.data)
    if (!parsed.success) {
      return
    }

    const response = parsed.output

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
    this.rejectReady(new Error('Worker error'))
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
    if (this.latestBundleId !== null) {
      const previous = this.pending.get(this.latestBundleId)
      if (previous) {
        previous.reject(new DOMException('Superseded', 'AbortError'))
        this.pending.delete(this.latestBundleId)
      }
    }
    const id = this.nextId++
    this.latestBundleId = id
    return this.send<BundleResult>({
      id,
      type: 'bundle',
      subpath,
      selectedExports,
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
