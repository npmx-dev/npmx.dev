import type { ChangelogInfo } from '~~/shared/types/changelog'

export function usePackageChangelog(
  packageName: MaybeRefOrGetter<string | null | undefined>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<ChangelogInfo | null>(() => {
    const name = toValue(packageName)
    if (!name) return 'data:application/json,null' // returns null
    const ver = toValue(version)
    return `/api/changelog/info/${name}/v/${ver || 'latest'}`
  })
}
