import type { H3Event } from 'h3'
import { createError, setHeader } from 'h3'
import * as v from 'valibot'
import { FilePathSchema, PackageNameSchema, VersionSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

/**
 * Cache-Control for a rejected package coordinate: long enough that a crawler
 * walking junk URLs costs one origin request, and without `Set-Cookie`, which
 * would stop the CDN caching the response at all.
 */
export const INVALID_PACKAGE_PARAM_CACHE_CONTROL = `public, max-age=${CACHE_MAX_AGE_ONE_HOUR}, s-maxage=${CACHE_MAX_AGE_ONE_HOUR}`

/** Throws the cheap, cacheable 404 used for every implausible package coordinate. */
function invalidPackageParam(event: H3Event, message: string): never {
  setHeader(event, 'Cache-Control', INVALID_PACKAGE_PARAM_CACHE_CONTROL)
  throw createError({ statusCode: 404, message })
}

interface RawPackageParams {
  packageName?: string | null
  version?: string | null
  filePath?: string | null
}

interface ValidPackageParams {
  packageName: string
  version?: string
  filePath?: string
}

function decode(param: string): string | undefined {
  try {
    return decodeURIComponent(param)
  } catch {
    return undefined
  }
}

/**
 * Decode and validate the package coordinates taken from a route, answering with a
 * cacheable 404 instead of a request to npm, jsDelivr or GitHub when they cannot be real.
 */
export function validPackageParams(event: H3Event, raw: RawPackageParams): ValidPackageParams {
  const packageName = raw.packageName == null ? undefined : decode(raw.packageName)
  if (!packageName || !v.is(PackageNameSchema, packageName)) {
    invalidPackageParam(event, 'Invalid package name')
  }

  const params: ValidPackageParams = { packageName }

  if (raw.version != null) {
    const version = decode(raw.version)
    if (!version || !v.is(VersionSchema, version)) {
      invalidPackageParam(event, 'Invalid version')
    }
    params.version = version
  }

  if (raw.filePath != null) {
    const filePath = decode(raw.filePath)
    if (!filePath || !v.is(FilePathSchema, filePath)) {
      invalidPackageParam(event, 'Invalid file path')
    }
    params.filePath = filePath
  }

  return params
}
