import type { PackageFileProvider } from '#shared/utils/package-files'
import { getPackageFileUrl, getPackageMetadataUrl } from '#shared/utils/package-files'

export interface PackageFetchResult {
  provider: PackageFileProvider
  response: Response
}

export class PackageResponseTooLargeError extends Error {
  constructor(public readonly sizeBytes: number) {
    super('Package response exceeded the size limit')
    this.name = 'PackageResponseTooLargeError'
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel()
  } catch {
    // A failed body cancellation must not hide the caller's real outcome.
  }
}

export async function readPackageResponseText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = response.headers.get('content-length')
  const declaredSize = contentLength ? Number.parseInt(contentLength, 10) : Number.NaN
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    await cancelResponseBody(response)
    throw new PackageResponseTooLargeError(declaredSize)
  }

  if (!response.body) {
    const content = await response.text()
    const sizeBytes = Buffer.byteLength(content, 'utf8')
    if (sizeBytes > maxBytes) throw new PackageResponseTooLargeError(sizeBytes)
    return content
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let sizeBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      sizeBytes += value.byteLength
      if (sizeBytes > maxBytes) {
        try {
          await reader.cancel()
        } catch {
          // A failed body cancellation must not hide the size-limit error.
        }
        throw new PackageResponseTooLargeError(sizeBytes)
      }

      chunks.push(decoder.decode(value, { stream: true }))
    }

    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    reader.releaseLock()
  }
}

async function fetchWithFallback(
  primaryUrl: string,
  fallbackUrl: string,
  signal?: AbortSignal,
): Promise<PackageFetchResult> {
  const primary = await fetch(primaryUrl, { signal })
  if (primary.status !== 403) {
    if (!primary.ok) await cancelResponseBody(primary)
    return { provider: 'jsdelivr', response: primary }
  }

  await cancelResponseBody(primary)

  const fallback = await fetch(fallbackUrl, { signal })
  if (!fallback.ok) await cancelResponseBody(fallback)
  return { provider: 'unpkg', response: fallback }
}

export function fetchPackageFile(
  packageName: string,
  version: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<PackageFetchResult> {
  return fetchWithFallback(
    getPackageFileUrl('jsdelivr', packageName, version, filePath),
    getPackageFileUrl('unpkg', packageName, version, filePath),
    signal,
  )
}

export function fetchPackageMetadata(
  packageName: string,
  version: string,
  signal?: AbortSignal,
): Promise<PackageFetchResult> {
  return fetchWithFallback(
    getPackageMetadataUrl('jsdelivr', packageName, version),
    getPackageMetadataUrl('unpkg', packageName, version),
    signal,
  )
}
