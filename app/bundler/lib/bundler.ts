import { encodeUtf8, getUtf8Length } from '@atcute/uint8array'
import type { PluginContext } from '@rolldown/browser'
import { rolldown } from '@rolldown/browser'
import { memfs } from '@rolldown/browser/experimental'
import * as zstdWasm from '@bokuweb/zstd-wasm'

import { progress } from '../events'
import type { BundleChunk, BundleOptions, BundleResult } from '../types'

import { BundleError } from './errors'
import { analyzeModule } from './module-type'

const { volume } = memfs!

// #region helpers

const VIRTUAL_ENTRY_ID = '\0virtual:entry'

/**
 * get compressed size using a compression stream.
 */
async function getCompressedSize(code: string, format: CompressionFormat): Promise<number> {
  const stream = new Blob([code]).stream()
  const compressed = stream.pipeThrough(new CompressionStream(format))
  const reader = compressed.getReader()

  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    size += value.byteLength
  }

  return size
}

/**
 * get gzip size using compression stream.
 */
function getGzipSize(code: string): Promise<number> {
  return getCompressedSize(code, 'gzip')
}

/**
 * whether brotli compression is supported.
 * - `undefined`: not yet checked
 * - `true`: supported
 * - `false`: not supported
 */
let isBrotliSupported: boolean | undefined

/**
 * get brotli size using compression stream, if supported.
 * returns `undefined` if brotli is not supported by the browser.
 */
async function getBrotliSize(code: string): Promise<number | undefined> {
  if (isBrotliSupported === false) {
    return undefined
  }

  if (isBrotliSupported === undefined) {
    try {
      // @ts-expect-error 'brotli' is not in the type definition yet
      const size = await getCompressedSize(code, 'brotli')
      isBrotliSupported = true
      return size
    } catch {
      isBrotliSupported = false
      return undefined
    }
  }

  // @ts-expect-error 'brotli' is not in the type definition yet
  return getCompressedSize(code, 'brotli')
}

let zstdInitialized = false

/**
 * get zstd-compressed size using wasm.
 * returns `undefined` if wasm failed to initialize.
 */
async function getZstdSize(code: string): Promise<number | undefined> {
  if (!zstdInitialized) {
    try {
      await zstdWasm.init()
      zstdInitialized = true
    } catch {
      return undefined
    }
  }

  const encoded = encodeUtf8(code)
  const compressed = zstdWasm.compress(encoded)
  return compressed.byteLength
}

// #endregion

// #region core

/**
 * bundles a subpath from a package that's already loaded in rolldown's memfs.
 *
 * @param packageName the package name (e.g., "react")
 * @param subpath the export subpath to bundle (e.g., ".", "./utils")
 * @param selectedExports specific exports to include, or null for all
 * @param options bundling options
 * @returns bundle result with chunks, sizes, and exported names
 */
export async function bundlePackage(
  packageName: string,
  subpath: string,
  selectedExports: string[] | null,
  options: BundleOptions,
): Promise<BundleResult> {
  // track whether module is CJS (set in load hook)
  let isCjs = false

  // bundle with rolldown
  const bundle = await rolldown({
    input: { main: VIRTUAL_ENTRY_ID },
    cwd: '/',
    external: options.rolldown?.external,
    plugins: [
      {
        name: 'virtual-entry',
        resolveId(id: string) {
          if (id === VIRTUAL_ENTRY_ID) {
            return id
          }
        },
        async load(this: PluginContext, id: string) {
          if (id !== VIRTUAL_ENTRY_ID) {
            return
          }

          const importPath = subpath === '.' ? packageName : `${packageName}${subpath.slice(1)}`

          // resolve the entry module
          const resolved = await this.resolve(importPath)
          if (!resolved) {
            throw new BundleError(`failed to resolve entry module: ${importPath}`)
          }

          // JSON files only have a default export
          if (resolved.id.endsWith('.json')) {
            return `export { default } from '${importPath}';\n`
          }

          // read the source file
          let source: string
          try {
            source = volume.readFileSync(resolved.id, 'utf8') as string
          } catch {
            throw new BundleError(`failed to read entry module: ${resolved.id}`)
          }

          // parse and analyze the module
          let ast
          try {
            ast = this.parse(source)
          } catch {
            throw new BundleError(`failed to parse entry module: ${resolved.id}`)
          }

          const moduleInfo = analyzeModule(ast)
          isCjs = moduleInfo.type === 'cjs'

          // CJS modules can't be tree-shaken effectively, just re-export default
          if (moduleInfo.type === 'cjs') {
            return `export { default } from '${importPath}';\n`
          }

          // unknown/side-effects only modules have no exports
          if (moduleInfo.type === 'unknown') {
            return `export {} from '${importPath}';\n`
          }

          // ESM module handling
          if (selectedExports === null) {
            // re-export everything
            let code = `export * from '${importPath}';\n`
            if (moduleInfo.hasDefaultExport) {
              code += `export { default } from '${importPath}';\n`
            }
            return code
          }

          // specific exports selected (empty array = export nothing)
          // quote names to handle non-identifier exports
          const quoted = selectedExports.map(e => JSON.stringify(e))
          return `export { ${quoted.join(', ')} } from '${importPath}';\n`
        },
      },
    ],
  })

  const output = await bundle.generate({
    format: 'esm',
    minify: options.rolldown?.minify ?? true,
  })

  // process all chunks
  const rawChunks = output.output.filter(o => o.type === 'chunk')

  progress.trigger({ type: 'progress', kind: 'compress' })

  const chunks: BundleChunk[] = await Promise.all(
    rawChunks.map(async chunk => {
      const code = chunk.code
      const size = getUtf8Length(code)
      const [gzipSize, brotliSize, zstdSize] = await Promise.all([
        getGzipSize(code),
        getBrotliSize(code),
        getZstdSize(code),
      ])

      return {
        fileName: chunk.fileName,
        code,
        size,
        gzipSize,
        brotliSize,
        zstdSize,
        isEntry: chunk.isEntry,
        exports: chunk.exports || [],
      }
    }),
  )

  // find entry chunk for exports
  const entryChunk = chunks.find(c => c.isEntry)
  if (!entryChunk) {
    throw new BundleError('no entry chunk found in bundle output')
  }

  // aggregate sizes
  const totalSize = chunks.reduce((acc, c) => acc + c.size, 0)
  const totalGzipSize = chunks.reduce((acc, c) => acc + c.gzipSize, 0)
  const totalBrotliSize =
    isBrotliSupported && chunks.every(c => c.brotliSize != null)
      ? chunks.reduce((acc, c) => acc + c.brotliSize!, 0)
      : undefined
  const totalZstdSize =
    zstdInitialized && chunks.every(c => c.zstdSize != null)
      ? chunks.reduce((acc, c) => acc + c.zstdSize!, 0)
      : undefined

  await bundle.close()

  return {
    chunks,
    size: totalSize,
    gzipSize: totalGzipSize,
    brotliSize: totalBrotliSize,
    zstdSize: totalZstdSize,
    exports: entryChunk.exports,
    isCjs,
  }
}

// #endregion
