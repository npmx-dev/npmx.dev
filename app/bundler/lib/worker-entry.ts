/* eslint-disable unicorn/require-post-message-target-origin -- Worker.postMessage doesn't take targetOrigin */
import { memfs } from '@rolldown/browser/experimental'
import * as v from 'valibot'

import { stripAnsi } from '../strings'
import { progress } from '../events'
import {
  workerRequestSchema,
  type BundleOptions,
  type InitOptions,
  type InitResult,
  type WorkerResponse,
} from '../types'

import { bundlePackage } from './bundler'
import { fetchPackagesToVolume } from './fetch'
import { hoist } from './hoist'
import { buildInstalledPackages } from './installed-packages'
import { resolve } from './resolve'
import { discoverSubpaths } from './subpaths'
import type { PackageJson } from './types'

const { volume } = memfs!

// forward progress events to main thread
progress.on(msg => {
  self.postMessage(msg satisfies WorkerResponse)
})

// #region state

let packageName: string | null = null
let initResult: InitResult | null = null

let bundleInProgress = false
let pendingBundleRequest: {
  id: number
  subpath: string
  selectedExports: string[] | null
  options: BundleOptions
} | null = null

// #endregion

// #region handlers

async function handleInit(
  id: number,
  packageSpec: string,
  options: InitOptions = {},
): Promise<void> {
  // if already initialized, return cached result
  if (initResult !== null) {
    self.postMessage({ id, type: 'init', result: initResult } satisfies WorkerResponse)
    return
  }

  try {
    volume.reset()

    const resolution = await resolve([packageSpec], options.resolve)
    const hoisted = hoist(resolution.roots)

    await fetchPackagesToVolume(hoisted, volume, options.fetch)

    const mainPackage = resolution.roots[0]
    if (!mainPackage) {
      throw new Error(`Failed to resolve package: ${packageSpec}`)
    }

    const pkgJsonPath = `/node_modules/${mainPackage.name}/package.json`
    const pkgJsonContent = volume.readFileSync(pkgJsonPath, 'utf8') as string
    const manifest = JSON.parse(pkgJsonContent) as PackageJson

    packageName = mainPackage.name

    const subpaths = discoverSubpaths(manifest, volume)

    // get peer dependency names from manifest
    const peerDependencies = Object.keys(manifest.peerDependencies ?? {})
    const peerDepNames = new Set(peerDependencies)

    const packages = buildInstalledPackages(mainPackage, peerDepNames)
    const installSize = packages.reduce((sum, pkg) => sum + pkg.size, 0)

    initResult = {
      name: mainPackage.name,
      version: mainPackage.version,
      subpaths,
      installSize,
      packages,
      peerDependencies,
    }

    self.postMessage({ id, type: 'init', result: initResult } satisfies WorkerResponse)
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: stripAnsi(String(error)),
    } satisfies WorkerResponse)
  }
}

async function handleBundle(
  id: number,
  subpath: string,
  selectedExports: string[] | null,
  options: BundleOptions = {},
): Promise<void> {
  if (!packageName) {
    self.postMessage({
      id,
      type: 'error',
      error: 'not initialized - call init() first',
    } satisfies WorkerResponse)
    return
  }

  // if a bundle is in progress, queue this one (replacing any previous pending)
  if (bundleInProgress) {
    // reject the previous pending request if any
    if (pendingBundleRequest) {
      self.postMessage({
        id: pendingBundleRequest.id,
        type: 'error',
        error: 'Superseded by newer request',
      } satisfies WorkerResponse)
    }
    pendingBundleRequest = { id, subpath, selectedExports, options }
    return
  }

  await processBundleRequest(id, subpath, selectedExports, options)
}

async function processBundleRequest(
  id: number,
  subpath: string,
  selectedExports: string[] | null,
  options: BundleOptions,
): Promise<void> {
  bundleInProgress = true

  try {
    const result = await bundlePackage(packageName!, subpath, selectedExports, options)
    self.postMessage({ id, type: 'bundle', result } satisfies WorkerResponse)
  } catch (error) {
    self.postMessage({
      id,
      type: 'error',
      error: stripAnsi(String(error)),
    } satisfies WorkerResponse)
  } finally {
    bundleInProgress = false

    // process pending request if any
    if (pendingBundleRequest) {
      const pending = pendingBundleRequest
      pendingBundleRequest = null
      await processBundleRequest(
        pending.id,
        pending.subpath,
        pending.selectedExports,
        pending.options,
      )
    }
  }
}

// #endregion

// #region message handler

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = v.safeParse(workerRequestSchema, event.data)
  if (!parsed.success) {
    return
  }

  const request = parsed.output

  switch (request.type) {
    case 'init':
      handleInit(request.id, request.packageSpec, request.options)
      break
    case 'bundle':
      handleBundle(request.id, request.subpath, request.selectedExports, request.options)
      break
  }
})

// signal to main thread that we're ready
self.postMessage({ type: 'ready' })

// #endregion
