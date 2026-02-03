import type { JsDelivrFileNode } from '#shared/types'

/**
 * Changelog filenames to check (case-insensitive match, priority order)
 * Based on common conventions in npm packages
 */
export const CHANGELOG_FILENAMES = [
  'CHANGELOG.md',
  'CHANGELOG',
  'CHANGELOG.txt',
  'changelog.md',
  'changelog',
  'HISTORY.md',
  'HISTORY',
  'history.md',
  'CHANGES.md',
  'CHANGES',
  'changes.md',
  'NEWS.md',
  'RELEASES.md',
] as const

/**
 * Find a changelog file in the package's root-level files.
 * Returns the actual filename if found, null otherwise.
 *
 * @param files - The file tree from jsDelivr API (root-level files only)
 * @returns The changelog filename if found, null otherwise
 */
export function findChangelogFile(files: JsDelivrFileNode[]): string | null {
  // Create a map for case-insensitive lookup of actual filenames
  const fileMap = new Map<string, string>()
  for (const file of files) {
    if (file.type === 'file') {
      fileMap.set(file.name.toLowerCase(), file.name)
    }
  }

  // Check for changelog files in priority order
  for (const changelogName of CHANGELOG_FILENAMES) {
    const actualName = fileMap.get(changelogName.toLowerCase())
    if (actualName) {
      return actualName
    }
  }

  return null
}
