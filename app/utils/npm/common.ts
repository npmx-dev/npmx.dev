/**
 * Constructs a scope:team string in the format expected by npm.
 * npm operations require the format @scope:team (with @ prefix).
 *
 * @param orgName - The organization name (with or without @)
 * @param teamName - The team name
 * @returns The scope:team string in @scope:team format
 */
export function buildScopeTeam(orgName: string, teamName: string): `@${string}:${string}` {
  return `@${orgName.replace(/^@/, '')}:${teamName}`
}
