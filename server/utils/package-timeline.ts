import { analyzePackage } from '#shared/utils/package-analysis'

interface TimelineVersionWithTypes {
  version: string
  hasTypes?: boolean
}

export async function enrichTimelineVersionTypes(
  packageName: string,
  allVersions: TimelineVersionWithTypes[],
  visibleVersions: TimelineVersionWithTypes[],
): Promise<void> {
  // File-aware detection is limited to potential removal events: metadata-untyped
  // versions with an older typed release. Checking every untyped version would
  // require additional registry and file-tree requests.
  const possibleTypeRemovals = visibleVersions
    .filter(version => {
      if (version.hasTypes) return false

      const versionIndex = allVersions.indexOf(version)
      return allVersions.slice(versionIndex + 1).some(previousVersion => previousVersion.hasTypes)
    })
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
