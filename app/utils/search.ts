export interface ParsedSearchQuery {
  /**
   * The package name, in the format:
   * - unscoped: `nuxt`
   * - scoped: `@nuxt/devtools`
   */
  name: string
  /**
   * The package specifier, e.g.
   * - `nuxt` -> `nuxt`
   * - `@nuxt/devtools` -> `devtools`
   */
  specifier: string
  /**
   * The package scope (or org), e.g.
   * - `nuxt` -> `undefined`
   * - `@nuxt/devtools` -> `nuxt`
   */
  scope?: string
  /**
   * Optionally, the version info if specified using the syntax:
   * - `nuxt@^4.0.0` -> `^4.0.0`
   * - `@nuxt/devtools@latest` -> `latest`
   */
  version?: string
  /**
   * The untrimmed trailing text after the package query.
   */
  trailing?: string
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const q = query.trim()

  // Regex matches a (un)scoped package and optionally extracts versioning info and trailing text using the following syntax: @scope/specifier@version
  // It makes use of 4 capture groups to extract this info.
  const match = q.match(
    /^(?:@(?<scope>[^/]+)\/)?(?<specifier>[^/@ ]+)(?:@(?<version>[^ ]*))?(?<trailing>.*)/,
  )
  if (!match) return { name: q, specifier: q }

  const { scope, specifier, version, trailing } = match.groups ?? {}
  if (!specifier) return { name: q, specifier: q }

  const name = scope ? `@${scope}/${specifier}` : specifier
  return { name, specifier, scope, version, trailing }
}
