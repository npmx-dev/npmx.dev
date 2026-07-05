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
  let vIndex = segments.indexOf('v')

  // If we encounter ".../v/v/...", treat the second "v" as the version delimiter.
  if (segments[vIndex] === 'v' && segments[vIndex + 1] === 'v') {
    vIndex++
  }

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

/**
 * Parse a package spec into its name and optional version.
 * Handles formats like: `name`, `name@version`, `@scope/name`, `@scope/name@version`.
 *
 * The version segment may be an exact version or a dist-tag (e.g. `next`); it is
 * returned verbatim for the caller to resolve.
 *
 * @example
 * ```ts
 * parsePackageSpec('react') // { name: 'react' }
 * parsePackageSpec('react@18.2.0') // { name: 'react', version: '18.2.0' }
 * parsePackageSpec('@vue/reactivity') // { name: '@vue/reactivity' }
 * parsePackageSpec('@vue/reactivity@3.4.0') // { name: '@vue/reactivity', version: '3.4.0' }
 * ```
 */
export function parsePackageSpec(input: string): { name: string; version?: string } {
  if (input.startsWith('@')) {
    // Scoped package: @scope/name or @scope/name@version
    const slashIndex = input.indexOf('/')
    if (slashIndex === -1) {
      // Invalid format like just "@scope"
      return { name: input }
    }
    const afterSlash = input.slice(slashIndex + 1)
    const atIndex = afterSlash.indexOf('@')
    if (atIndex === -1) {
      // @scope/name (no version)
      return { name: input }
    }
    // @scope/name@version
    return {
      name: input.slice(0, slashIndex + 1 + atIndex),
      version: afterSlash.slice(atIndex + 1),
    }
  }

  // Unscoped package: name or name@version
  const atIndex = input.indexOf('@')
  if (atIndex === -1) {
    return { name: input }
  }
  return {
    name: input.slice(0, atIndex),
    version: input.slice(atIndex + 1),
  }
}
