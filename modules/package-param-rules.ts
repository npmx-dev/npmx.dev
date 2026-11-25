import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'

interface VercelRoute {
  src?: string
  dest?: string
  handle?: string
  status?: number
  headers?: Record<string, string>
}

/**
 * Characters allowed in the name part of a URL segment: everything `validate-npm-package-name`
 * accepts (`A-Za-z0-9-_.!~*'()`), plus `@` and percent escapes.
 */
const SEGMENT_CHARS = String.raw`A-Za-z0-9._~!'()*@%+-`

/** Characters that can appear in a version segment: what `VersionSchema` allows, plus `%`. */
const VERSION_CHARS = String.raw`A-Za-z0-9_.+!~*'()%-`

const NOT_FOUND = {
  status: 404,
  headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
}

const alternation = (sources: string[]) => `(?:${sources.map(source => `(?:${source})`).join('|')})`

/** Characters npm has never allowed in a name. */
const INVALID_CHARS = [
  // Whitespace, brackets and punctuation outside npm's URL-safe set.
  String.raw`[^/]*[^/${SEGMENT_CHARS}][^/]*`,
  // Percent-encoded space or control character.
  String.raw`[^/]*%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|20|7[Ff])[^/]*`,
]

/**
 * Longer than npm's 214-character limit. Only unescaped segments are measured, since a
 * percent escape makes the raw length longer than the name. `validate-npm-package-name` only
 * warns about these names, so the shared schema accepts them.
 */
const TOO_LONG = String.raw`[^/%]{215,}`

/**
 * `validate-npm-package-name` rejects a name that begins with a period or an underscore, and
 * a scoped name whose name part begins with a period, encoded or not.
 */
const INVALID_LEADING_CHAR = [
  String.raw`(?:%2[Ee]|\.|_)[^/]*`,
  // `@scope%2F.name`, where the scope separator stays inside one segment.
  String.raw`[^/]*%2[Ff](?:%2[Ee]|\.)[^/]*`,
]

/**
 * For a scoped package only the name part is checked, and only for a leading period:
 * `@scope/_name`, `@_scope/name` and `@.scope/name` are all accepted.
 */
const INVALID_SCOPED_LEADING_CHAR = String.raw`(?:%2[Ee]|\.)[^/]*`

/** A version segment that neither a version nor a dist-tag can be. */
const INVALID_VERSION = [
  String.raw`[^/]*[^/${VERSION_CHARS}][^/]*`,
  // Percent-encoded space or control character.
  String.raw`[^/]*%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|20|7[Ff])[^/]*`,
  // Long enough that it cannot be a version, even with build metadata. Unescaped only.
  String.raw`[^/%]{257,}`,
]

/**
 * Path prefixes whose next segment is the package name, or the scope of a scoped name.
 */
const PACKAGE_PREFIXES = [
  'package',
  'package-timeline',
  'package-stats',
  'package-changelog',
  'package-code',
  'package-docs',
  'diff',
  'changelog',
  'skills',
  'api/changelog/info',
  'api/jsr',
  'api/registry/analysis',
  // `badge` takes a badge type before the package name.
  'api/registry/badge/[^/]+',
  'api/registry/compare',
  'api/registry/compare-file',
  'api/registry/docs',
  'api/registry/file',
  'api/registry/files',
  'api/registry/install-size',
  'api/registry/license-change',
  'api/registry/org',
  'api/registry/package-meta',
  'api/registry/packument',
  'api/registry/provenance',
  'api/registry/readme',
  'api/registry/readme/markdown',
  'api/registry/timeline',
  'api/registry/timeline/sizes',
  'api/registry/vulnerabilities',
  'api/social/likes',
  'api/social/likes-evolution',
]

/** Package-scoped paths whose version follows a `/v/` segment. */
const VERSION_PREFIXES = PACKAGE_PREFIXES.filter(prefix => !prefix.startsWith('api/registry/org'))

/**
 * Routes that return a CDN-cacheable 404 for junk package URLs before any function runs.
 * A name rule only matches what `validate-npm-package-name` rejects, or a name over 214
 * characters.
 */
export function invalidPackageRoutes(): VercelRoute[] {
  const name = alternation([...INVALID_CHARS, TOO_LONG, ...INVALID_LEADING_CHAR])
  const scopedName = alternation([...INVALID_CHARS, TOO_LONG, INVALID_SCOPED_LEADING_CHAR])
  const version = alternation(INVALID_VERSION)
  const prefixes = `(?:${PACKAGE_PREFIXES.join('|')})`
  const versionPrefixes = `(?:${VERSION_PREFIXES.join('|')})`
  const route = (src: string): VercelRoute => ({ src, ...NOT_FOUND })

  return [
    // Junk in the name segment, or in the name of a scoped package.
    route(`^/${prefixes}/${name}`),
    route(`^/${prefixes}/@[^/]*/${scopedName}`),
    // A scope with no name after it (an encoded slash means the name is there).
    route(`^/${prefixes}/@[^/%]*/?$`),
    // A whole `..` segment in any position, which the file path schema rejects.
    route(`^/${prefixes}/(?:.*/)?\\.\\.(?:/|$)`),
    route(`^/${prefixes}/(?:.*/)?%2[Ee]%2[Ee](?:/|$)`),
    // Junk in a version, which follows the package name and a `/v/`.
    route(`^/${versionPrefixes}/(?:@[^/]+/[^/]+|[^/]+)/v/${version}`),
    // `/:pkg/.well-known/skills` has no fixed prefix: the first segment is the name.
    route(`^/${name}/\\.well-known/skills(?:/|$)`),
    route(`^/@[^/]*/${scopedName}/\\.well-known/skills(?:/|$)`),
    route(`^/@[^/]*/\\.well-known/skills(?:/|$)`),
  ]
}

/** Mounts [invalidPackageRoutes] in front of the first function route in a build's routing config. */
export function addInvalidPackageRoutes(configPath: string) {
  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { routes: VercelRoute[] }
  const index = config.routes.findIndex(route => route.dest)
  if (index === -1) {
    throw new Error('[package-param-rules] could not find the first function route')
  }
  config.routes.splice(index, 0, ...invalidPackageRoutes())
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export default defineNuxtModule({
  meta: {
    name: 'package-param-rules',
  },
  setup(_, nuxt) {
    nuxt.hook('nitro:init', nitro => {
      if (!nitro.options.preset.startsWith('vercel')) {
        return
      }
      nitro.hooks.hook('compiled', () => {
        addInvalidPackageRoutes(resolve(nitro.options.output.dir, 'config.json'))
      })
    })
  },
})
