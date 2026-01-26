/**
 * Deno Integration
 *
 * Functions for running deno doc and processing its output.
 * This is the layer that differs between microservice and WASM implementations.
 *
 * @module server/utils/docs/client
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DenoDocResult } from '#shared/types/deno-doc'

const execFileAsync = promisify(execFile)

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for deno doc command in milliseconds (2 minutes) */
const DENO_DOC_TIMEOUT_MS = 2 * 60 * 1000

/** Maximum buffer size for deno doc output (50MB for large packages like React) */
const DENO_DOC_MAX_BUFFER = 50 * 1024 * 1024

// =============================================================================
// Deno Integration
// =============================================================================

/** Cached promise for deno availability check - computed once on first access */
let denoCheckPromise: Promise<boolean> | null = null

/**
 * Check if deno is installed (cached after first check).
 */
async function isDenoInstalled(): Promise<boolean> {
  if (!denoCheckPromise) {
    denoCheckPromise = execFileAsync('deno', ['--version'], { timeout: 5000 })
      .then(() => true)
      .catch(() => false)
  }
  return denoCheckPromise
}

/**
 * Verify that deno is installed and available.
 * @throws {Error} If deno is not installed
 */
export async function verifyDenoInstalled(): Promise<void> {
  const available = await isDenoInstalled()
  if (!available) {
    throw new Error('Deno is not installed. Please install Deno to generate API documentation: https://deno.land')
  }
}

/**
 * Build esm.sh URL for a package that deno doc can process.
 */
export function buildEsmShUrl(packageName: string, version: string): string {
  return `https://esm.sh/${packageName}@${version}?target=deno`
}

/**
 * Run deno doc and parse the JSON output.
 */
export async function runDenoDoc(specifier: string): Promise<DenoDocResult> {
  try {
    const { stdout } = await execFileAsync(
      'deno',
      ['doc', '--json', specifier],
      {
        maxBuffer: DENO_DOC_MAX_BUFFER,
        timeout: DENO_DOC_TIMEOUT_MS,
      },
    )

    return JSON.parse(stdout) as DenoDocResult
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
        throw new Error(`Deno doc timed out after ${DENO_DOC_TIMEOUT_MS / 1000}s - package may be too large`)
      }
      throw new Error(`Deno doc failed: ${error.message}`)
    }
    throw new Error('Deno doc failed with unknown error')
  }
}
