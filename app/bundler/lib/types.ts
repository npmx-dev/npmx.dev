import * as v from 'valibot'

// #region package.json schema

/**
 * package exports field - can be a string, array, object, or nested conditions.
 * @see https://nodejs.org/api/packages.html#exports
 */
const packageExportsSchema: v.GenericSchema<PackageExports> = v.union([
  v.null(),
  v.string(),
  v.array(v.string()),
  v.record(
    v.string(),
    v.lazy(() => packageExportsSchema),
  ),
])

export type PackageExports = string | string[] | { [key: string]: PackageExports } | null

/**
 * base package.json schema with all standard fields.
 * other schemas pick from this to ensure consistency.
 * @see https://docs.npmjs.com/cli/v10/configuring-npm/package-json
 */
export const packageJsonSchema = v.object({
  name: v.string(),
  version: v.string(),
  description: v.optional(v.string()),
  keywords: v.optional(v.array(v.string())),
  homepage: v.optional(v.string()),
  license: v.optional(v.string()),
  main: v.optional(v.string()),
  module: v.optional(v.string()),
  browser: v.optional(
    v.union([v.string(), v.record(v.string(), v.union([v.string(), v.literal(false)]))]),
  ),
  types: v.optional(v.string()),
  typings: v.optional(v.string()),
  exports: v.optional(packageExportsSchema),
  type: v.optional(v.picklist(['module', 'commonjs'])),
  bin: v.optional(v.union([v.string(), v.record(v.string(), v.string())])),
  directories: v.optional(v.record(v.string(), v.string())),
  dependencies: v.optional(v.record(v.string(), v.string())),
  devDependencies: v.optional(v.record(v.string(), v.string())),
  peerDependencies: v.optional(v.record(v.string(), v.string())),
  peerDependenciesMeta: v.optional(
    v.record(v.string(), v.object({ optional: v.optional(v.boolean()) })),
  ),
  bundleDependencies: v.optional(v.union([v.boolean(), v.array(v.string())])),
  optionalDependencies: v.optional(v.record(v.string(), v.string())),
  engines: v.optional(v.record(v.string(), v.string())),
  os: v.optional(v.array(v.string())),
  cpu: v.optional(v.array(v.string())),
  deprecated: v.optional(v.union([v.string(), v.boolean()])),
  sideEffects: v.optional(v.union([v.boolean(), v.array(v.string())])),
})

export type PackageJson = v.InferOutput<typeof packageJsonSchema>

// #endregion

// #region abbreviated packument schemas

/**
 * distribution metadata for a package version.
 */
const distSchema = v.object({
  tarball: v.string(),
  shasum: v.string(),
  integrity: v.optional(v.string()),
  fileCount: v.optional(v.number()),
  unpackedSize: v.optional(v.number()),
  signatures: v.optional(
    v.array(
      v.object({
        keyid: v.string(),
        sig: v.string(),
      }),
    ),
  ),
})

/**
 * abbreviated manifest for a specific version.
 * picks installation-relevant fields from package.json and adds registry metadata.
 * @see https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md#abbreviated-metadata-format
 */
export const abbreviatedManifestSchema = v.object({
  // pick installation-relevant fields from package.json
  ...v.pick(packageJsonSchema, [
    'name',
    'version',
    'deprecated',
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'bundleDependencies',
    'peerDependencies',
    'peerDependenciesMeta',
    'bin',
    'directories',
    'engines',
    'cpu',
    'os',
  ]).entries,
  // registry-specific fields
  dist: distSchema,
  hasInstallScript: v.optional(v.boolean()),
  _hasShrinkwrap: v.optional(v.boolean()),
})

export type AbbreviatedManifest = v.InferOutput<typeof abbreviatedManifestSchema>

/**
 * abbreviated packument - minimal metadata for package resolution.
 * returned when requesting with Accept: application/vnd.npm.install-v1+json
 * @see https://github.com/npm/registry/blob/main/docs/responses/package-metadata.md#abbreviated-metadata-format
 */
export const abbreviatedPackumentSchema = v.object({
  'name': v.string(),
  // optional because some registries (e.g., JSR's npm mirror) may not include it
  'modified': v.optional(v.string()),
  'dist-tags': v.pipe(
    v.record(v.string(), v.string()),
    v.check(tags => 'latest' in tags, 'dist-tags must include "latest"'),
  ),
  'versions': v.record(v.string(), abbreviatedManifestSchema),
})

export type AbbreviatedPackument = v.InferOutput<typeof abbreviatedPackumentSchema>

// #endregion

/**
 * a resolved package with its dependencies.
 * this is the output of the resolution step before hoisting.
 */
export interface ResolvedPackage {
  name: string
  version: string
  /** the tarball URL for fetching */
  tarball: string
  /** SRI integrity hash if available */
  integrity?: string
  /** unpacked size in bytes (from registry) */
  unpackedSize?: number
  /** resolved dependencies (name -> ResolvedPackage) */
  dependencies: Map<string, ResolvedPackage>
}

/**
 * supported package registries.
 */
export type Registry = 'npm' | 'jsr'

/**
 * the input to the resolver - a package specifier.
 * can be just a name (uses latest) or name@version/range.
 */
export interface PackageSpecifier {
  name: string
  /** version, range, or dist-tag. defaults to 'latest' */
  range: string
  /** which registry to fetch from. defaults to 'npm' */
  registry: Registry
}

/**
 * the full resolution result - a tree of resolved packages.
 */
export interface ResolutionResult {
  /** the root package(s) that were requested */
  roots: ResolvedPackage[]
  /** all unique packages in the resolution (for deduping) */
  packages: Map<string, ResolvedPackage>
}

/**
 * a node in the hoisted node_modules structure.
 * represents what should be written to node_modules/{name}
 */
export interface HoistedNode {
  name: string
  version: string
  tarball: string
  integrity?: string
  /** unpacked size in bytes (from registry) */
  unpackedSize?: number
  /** number of direct dependencies */
  dependencyCount: number
  /** nested node_modules for this package (when hoisting fails) */
  nested: Map<string, HoistedNode>
}

/**
 * the result of hoisting - a flat(ish) node_modules structure.
 */
export interface HoistedResult {
  /** top-level node_modules entries */
  root: Map<string, HoistedNode>
}
