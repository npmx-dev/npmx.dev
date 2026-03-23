/**
 * Detect whether a dependency version specifier points to a URL or Git source
 * rather than the npm registry.
 *
 * These bypass npm registry integrity checks and can be manipulated.
 * @see https://docs.npmjs.com/cli/v11/configuring-npm/package-json#git-urls-as-dependencies
 * @see https://docs.npmjs.com/cli/v11/configuring-npm/package-json#urls-as-dependencies
 */
export function isUrlDependency(version: string): boolean {
  // npm: protocol aliases are safe (resolved from the registry)
  if (version.startsWith('npm:')) return false

  // Protocols: git:, git+https:, git+ssh:, git+http:, https:, http:, file:
  if (/^[a-z][a-z+]*:/i.test(version)) return true

  // GitHub shorthand: user/repo or user/repo#ref
  // Also matches github:, gist:, bitbucket:, gitlab: (already caught above by protocol check)
  if (/^[^@][^/]*\/[^/]+/.test(version)) return true

  return false
}
