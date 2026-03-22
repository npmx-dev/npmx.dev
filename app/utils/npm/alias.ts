/**
 * Parses npm alias syntax: "npm:real-pkg@^1.0.0"
 * Returns { name, range } for the real package, or null if not an alias.
 *
 * @example
 * parseNpmAlias('npm:real-pkg@^1.0.0') // { name: 'real-pkg', range: '^1.0.0' }
 * parseNpmAlias('npm:@scope/pkg@^1.0.0') // { name: '@scope/pkg', range: '^1.0.0' }
 * parseNpmAlias('npm:real-pkg') // { name: 'real-pkg', range: '' }
 * parseNpmAlias('^1.0.0') // null
 */
export function parseNpmAlias(version: string): { name: string; range: string } | null {
  if (!version.startsWith('npm:')) return null
  const spec = version.slice(4) // strip 'npm:'
  // Handle scoped packages like @scope/pkg@1.0.0 — find @ after position 0
  const atIdx = spec.startsWith('@') ? spec.indexOf('@', 1) : spec.indexOf('@')
  if (atIdx === -1) return { name: spec, range: '' }
  return { name: spec.slice(0, atIdx), range: spec.slice(atIdx + 1) }
}
