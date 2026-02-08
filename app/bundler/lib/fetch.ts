import { untar } from '@mary/tar'
import type { Volume } from 'memfs'

import { progress } from '../events'

import { FetchError } from './errors'
import type { HoistedNode, HoistedResult } from './types'

/**
 * options for fetching packages.
 */
export interface FetchOptions {
  /** max concurrent fetches (default 6) */
  concurrency?: number
  /** regex patterns for files to exclude (matched against path after "package/" prefix is stripped) */
  exclude?: RegExp[]
}

/**
 * default patterns for files that are not needed for bundling.
 * matches against the file path within the package (e.g., "README.md", "docs/guide.md")
 */
const DEFAULT_EXCLUDE_PATTERNS: RegExp[] = [
  // docs and meta files
  /^README(\..*)?$/i,
  /^LICENSE(\..*)?$/i,
  /^LICENCE(\..*)?$/i,
  /^CHANGELOG(\..*)?$/i,
  /^HISTORY(\..*)?$/i,
  /^CONTRIBUTING(\..*)?$/i,
  /^AUTHORS(\..*)?$/i,
  /^SECURITY(\..*)?$/i,
  /^CODE_OF_CONDUCT(\..*)?$/i,
  /^\.github\//,
  /^\.vscode\//,
  /^\.idea\//,
  /^docs?\//i,

  // test files
  /^__tests__\//,
  /^tests?\//i,
  /^specs?\//i,
  /\.(test|spec)\.[jt]sx?$/,
  /\.stories\.[jt]sx?$/,

  // config files
  /^\..+rc(\..*)?$/,
  /^\.editorconfig$/,
  /^\.gitignore$/,
  /^\.npmignore$/,
  /^\.eslint/,
  /^\.prettier/,
  /^tsconfig(\..+)?\.json$/,
  /^jest\.config/,
  /^vitest\.config/,
  /^rollup\.config/,
  /^webpack\.config/,
  /^vite\.config/,
  /^babel\.config/,

  // source maps (usually not needed in bundling)
  /\.map$/,

  // typescript declaration files (not needed for bundling)
  /\.d\.[cm]?ts$/,

  // flow type annotations
  /\.js\.flow$/,
  /\.flow$/,

  // example/demo directories
  /^examples?\//i,
]

/**
 * fetches a tarball and writes its contents directly to a volume.
 * handles gzip decompression and strips the "package/" prefix from paths.
 *
 * @param url the tarball URL
 * @param destPath the destination path in the volume (e.g., "/node_modules/react")
 * @param volume the volume to write to
 * @param exclude regex patterns for files to skip
 * @returns the total size of extracted files in bytes
 */
async function fetchTarballToVolume(
  url: string,
  destPath: string,
  volume: Volume,
  exclude: RegExp[] = [],
): Promise<number> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new FetchError(url, response.status, response.statusText)
  }

  const body = response.body
  if (!body) {
    throw new FetchError(url, 0, 'response has no body')
  }

  // decompress gzip -> extract tar
  const decompressed = body.pipeThrough(new DecompressionStream('gzip'))

  let totalSize = 0

  for await (const entry of untar(decompressed)) {
    // skip directories
    if (entry.type !== 'file') {
      continue
    }

    // count size from tar header for all files (including excluded ones)
    totalSize += entry.size

    // npm tarballs have files under "package/" prefix - strip it
    let path = entry.name
    if (path.startsWith('package/')) {
      path = path.slice(8)
    }

    // check if file should be excluded (skip extraction but size already counted)
    if (exclude.some(pattern => pattern.test(path))) {
      continue
    }

    const content = await entry.bytes()
    const fullPath = `${destPath}/${path}`

    // ensure parent directories exist
    const parentDir = fullPath.slice(0, fullPath.lastIndexOf('/'))
    if (!volume.existsSync(parentDir)) {
      volume.mkdirSync(parentDir, { recursive: true })
    }

    volume.writeFileSync(fullPath, content)
  }

  return totalSize
}

/**
 * fetches all packages in a hoisted result and writes them to a volume.
 * uses default exclude patterns to skip unnecessary files.
 *
 * @param hoisted the hoisted package structure
 * @param volume the volume to write to
 * @param options fetch options
 */
export async function fetchPackagesToVolume(
  hoisted: HoistedResult,
  volume: Volume,
  options: FetchOptions = {},
): Promise<void> {
  const concurrency = options.concurrency ?? 6
  const exclude = options.exclude ?? DEFAULT_EXCLUDE_PATTERNS
  const queue: Array<{ node: HoistedNode; basePath: string }> = []

  // collect all nodes into a flat queue
  function collectNodes(node: HoistedNode, basePath: string): void {
    queue.push({ node, basePath })
    if (node.nested.size > 0) {
      const nestedBasePath = `${basePath}/${node.name}/node_modules`
      for (const nested of node.nested.values()) {
        collectNodes(nested, nestedBasePath)
      }
    }
  }

  for (const node of hoisted.root.values()) {
    collectNodes(node, '/node_modules')
  }

  // process queue with concurrency limit using a simple semaphore pattern
  let index = 0
  let completed = 0
  const total = queue.length

  async function worker(): Promise<void> {
    while (true) {
      const i = index++
      if (i >= queue.length) {
        break
      }

      const item = queue[i]
      if (!item) continue
      const { node, basePath } = item
      const packagePath = `${basePath}/${node.name}`

      const extractedSize = await fetchTarballToVolume(node.tarball, packagePath, volume, exclude)

      // use extracted size if registry didn't provide unpackedSize (e.g., JSR packages)
      if (node.unpackedSize === undefined) {
        node.unpackedSize = extractedSize
      }

      completed++
      progress.trigger({
        type: 'progress',
        kind: 'fetch',
        current: completed,
        total,
        name: node.name,
      })
    }
  }

  // start concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  await Promise.all(workers)
}
