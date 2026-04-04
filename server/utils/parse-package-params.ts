/**
 * Parses Nitro router segments into packageName and an optional version
 * Handles patterns: [pkg], [pkg, 'v', version], [@scope, pkg], [@scope, pkg, 'v', version]
 */
export function parsePackageParams(segments: string[]): {
  rawPackageName: string
  rawVersion: string | undefined
} {
  let vIndex = segments.indexOf('v')

  // If we encounter ".../v/v/...", treat the second "v" as the version delimiter.
  if (segments[vIndex] === 'v' && segments[vIndex + 1] === 'v') {
    vIndex++
  }

  if (vIndex !== -1 && vIndex < segments.length - 1) {
    return {
      rawPackageName: segments.slice(0, vIndex).join('/'),
      rawVersion: segments.slice(vIndex + 1).join('/'),
    }
  }

  return {
    rawPackageName: segments.join('/'),
    rawVersion: undefined,
  }
}
