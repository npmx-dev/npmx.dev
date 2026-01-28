/**
 * Parsed package parameters from URL path segments.
 */
export interface ParsedPackageParams {
  /** The npm package name (e.g., "vue", "@nuxt/kit") */
  packageName: string
  /** The version if specified (e.g., "3.4.0"), undefined otherwise */
  version: string | undefined
  /** Remaining path segments after the version (e.g., for file paths) */
  rest: string[]
}

/**
 * Parse package name, optional version, and remaining path from URL segments.
 *
 * Supports these URL patterns:
 * - `/pkg` → { packageName: "pkg", version: undefined, rest: [] }
 * - `/pkg/v/1.2.3` → { packageName: "pkg", version: "1.2.3", rest: [] }
 * - `/pkg/v/1.2.3/src/index.ts` → { packageName: "pkg", version: "1.2.3", rest: ["src", "index.ts"] }
 * - `/@scope/pkg` → { packageName: "@scope/pkg", version: undefined, rest: [] }
 * - `/@scope/pkg/v/1.2.3` → { packageName: "@scope/pkg", version: "1.2.3", rest: [] }
 *
 * @param pkgParam - The raw package parameter from the URL (e.g., "vue/v/3.4.0/src/index.ts")
 * @returns Parsed package name, optional version, and remaining path segments
 *
 * @example
 * ```ts
 * parsePackageParam('vue')
 * // { packageName: 'vue', version: undefined, rest: [] }
 *
 * parsePackageParam('vue/v/3.4.0')
 * // { packageName: 'vue', version: '3.4.0', rest: [] }
 *
 * parsePackageParam('@nuxt/kit/v/1.0.0/src/index.ts')
 * // { packageName: '@nuxt/kit', version: '1.0.0', rest: ['src', 'index.ts'] }
 * ```
 */
export function parsePackageParam(pkgParam: string): ParsedPackageParams {
  const segments = pkgParam.split('/')
  const vIndex = segments.indexOf('v')

  if (vIndex !== -1 && vIndex < segments.length - 1) {
    return {
      packageName: segments.slice(0, vIndex).join('/'),
      version: segments[vIndex + 1],
      rest: segments.slice(vIndex + 2),
    }
  }

  return {
    packageName: segments.join('/'),
    version: undefined,
    rest: [],
  }
}
