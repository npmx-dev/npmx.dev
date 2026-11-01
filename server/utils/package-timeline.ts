import { analyzePackage } from '#shared/utils/package-analysis'

interface TimelineVersionWithTypes {
  version: string
  hasTypes?: boolean
}

/**
 * Marks metadata-untyped versions as typed when their published files ship declarations
 * (e.g. `.d.mts` next to `.mjs`). Only versions for which `hasOlderTypedVersion` is true
 * are checked, since only those can produce a false "types removed" event.
 */
export async function enrichTimelineVersionTypes(
  packageName: string,
  visibleVersions: TimelineVersionWithTypes[],
  hasOlderTypedVersion: (version: string) => boolean,
): Promise<void> {
  // File-aware detection is limited to potential removal events: metadata-untyped
  // versions with an older typed release. Checking every untyped version would
  // require additional registry and file-tree requests.
  const possibleTypeRemovals = visibleVersions
    .filter(version => !version.hasTypes && hasOlderTypedVersion(version.version))
    .map(async version => {
      try {
        const { pkg, typesPackage, files } = await fetchPackageWithTypesAndFiles(
          packageName,
          version.version,
        )

        const analysis = analyzePackage(pkg, {
          typesPackage,
          files,
        })

        if (analysis.types.kind === 'included') {
          version.hasTypes = true
        }
      } catch {
        // Preserve the metadata-only result when the file list is unavailable.
      }
    })

  await Promise.all(possibleTypeRemovals)
}
