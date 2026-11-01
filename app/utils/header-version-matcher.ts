// This is used by changelog for matching version in a heading, this is here to allow testing

/**
 * Check a toc heading if it contains the asked version
 * @param version the version that needs to match
 */
export function createHeadingVersionMatcher(version: string) {
  // only matches the exact version for normal version, pre releases could match but shouldn't if ordered by release time
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const versionRegex = new RegExp(`(?<!\\d)(?:v|@)?${escapedVersion}\\b`)
  return (heading: string) => versionRegex.test(heading)
}
