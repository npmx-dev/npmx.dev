/**
 * Package coordinates used to check the three layers that reject impossible package
 * URLs: the edge rules in `modules/package-param-rules.ts`, the handler validation in
 * `server/utils/package-params.ts`, and `assertValidPackageRoute` for server renders.
 */

const LONG_SCOPED_NAME = `@scope/${'a'.repeat(200)}`

/** Real names that must keep working, however they are addressed. */
export const VALID_NAMES = [
  // Legacy names published before npm tightened its rules.
  'JSONStream',
  'Base64',
  'CSSselect',
  // Dots, underscores, tildes and apostrophes.
  'lodash.merge',
  'foo_bar',
  'foo~bar',
  "it's-a-name",
  // Very short names.
  'q',
  'a',
  // Scoped.
  '@types/node',
  '@nuxt/kit',
  LONG_SCOPED_NAME,
  // A leading `-` or `_` is only checked on the whole name, a leading period on the name part.
  '@scope/-x',
  '@scope/_x',
  '@_scope/pkg',
  '@.scope/pkg',
  'a..b',
  '@scope/pkg.',
]

/** Versions, prereleases, build metadata and dist-tags. */
export const VALID_VERSIONS = [
  '1.0.0',
  '1.0.0-beta.1+sha.abc',
  '0.0.1',
  'latest',
  'next',
  'canary!',
]

/** URLs for valid names, one per shape they are addressed by. */
const NAME_URLS = VALID_NAMES.flatMap(name => {
  const encoded = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : name
  return [
    `/package/${name}`,
    `/package/${encoded}`,
    `/package/${name}/v/${VALID_VERSIONS[1]}`,
    `/package/${name}/v/latest`,
    `/api/registry/packument/${name}`,
    `/api/registry/packument/${encoded}`,
    `/api/registry/packument/${encoded}?version=next`,
    `/api/registry/timeline/${name}`,
    `/api/registry/package-meta/${name}`,
    `/api/registry/readme/${name}/v/${VALID_VERSIONS[1]}`,
    `/api/registry/readme/markdown/${name}/v/${VALID_VERSIONS[1]}`,
    `/api/registry/timeline/sizes/${name}`,
    `/api/social/likes-evolution/${name}`,
    `/api/changelog/info/${name}/v/latest`,
    `/skills/${name}/v/1.0.0`,
    `/${name}/.well-known/skills/index.json`,
  ]
})

/** A file path can contain a `/v/` segment of its own, which is not a version. */
const FILE_PATH_URLS = [
  '/api/registry/file/vue/v/1.2.3/docs/v/file~1.ts',
  '/api/registry/files/vue/v/1.2.3/v/@types.ts',
  '/package-code/@nuxt/kit/v/1.0.0/src/v/A~B.ts',
]

/** Version ranges are `from...to`, as the diff page and the compare handlers parse them. */
const RANGE_URLS = [
  '/diff/vue/v/1.0.0...2.0.0',
  '/diff/@nuxt/kit/v/1.0.0-beta.1+sha.abc...2.0.0',
  '/diff/vue/v/latest...next',
  '/api/registry/compare/vue/v/1.0.0...2.0.0',
  '/api/registry/compare-file/vue/v/1.0.0...2.0.0/dist/index.js',
]

/** Lengths at the limit, and escapes that make the raw segment longer than the coordinate. */
const LENGTH_URLS = [
  `/package/${'a'.repeat(214)}`,
  `/package/${'%61'.repeat(80)}`,
  `/package/vue/v/1.0.0-${'%61'.repeat(90)}`,
]

/** A dist-tag can contain any character `encodeURIComponent` leaves alone. */
const TAG_URLS = ['/package/vue/v/canary!', `/package/vue/v/rc~(1)*'`]

export const VALID_URLS = [
  ...NAME_URLS,
  ...FILE_PATH_URLS,
  ...RANGE_URLS,
  ...LENGTH_URLS,
  ...TAG_URLS,
]

/** Coordinates no package can have, one per URL shape. */
export const INVALID_URLS = [
  `/package/${'a'.repeat(240)}`,
  `/package/${'a'.repeat(215)}`,
  `/api/registry/packument/${'a'.repeat(240)}`,
  `/package/foo%20bar`,
  `/package/foo bar`,
  `/package/.env`,
  `/package/.git/config`,
  `/package/_next`,
  `/package/%00foo`,
  `/package/%2E%2E`,
  `/package/foo/../bar`,
  `/package/vue/v/1.0.0/%2E%2E/etc/passwd`,
  `/package/@scope`,
  `/package/@scope/`,
  `/package/@sc%20ope/name`,
  `/package/@scope/foo%20bar`,
  `/package/@scope/.hidden`,
  `/package/@scope%2F.hidden`,
  `/package/foo/v/1.0.0%20beta`,
  `/package/foo/v/${'1'.repeat(300)}`,
  `/package/foo/v/1.0.0;rm -rf`,
  `/api/registry/packument/@scope`,
  `/api/registry/badge/version/foo%20bar`,
  `/api/registry/timeline/foo%0Abar`,
  `/api/registry/package-meta/.hidden`,
  `/api/registry/readme/foo%09bar`,
  `/api/registry/readme/markdown/.hidden`,
  `/api/registry/timeline/sizes/foo%20bar`,
  `/api/social/likes-evolution/_private`,
  `/skills/foo%20bar/v/1.0.0`,
  `/foo%20bar/.well-known/skills/index.json`,
  `/@scope/foo%20bar/.well-known/skills/index.json`,
  `/@scope/.well-known/skills/index.json`,
]
