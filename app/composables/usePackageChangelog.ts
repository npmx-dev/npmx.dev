import type { ChangelogInfo } from '~~/shared/types/changelog'

export function usePackageChangelog(
  packageName: MaybeRefOrGetter<string>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<ChangelogInfo>(() => {
    const name = toValue(packageName)
    const ver = toValue(version)
    const base = `/api/changelog/info/${name}`
    return ver ? `${base}/v/${ver}` : base
  })
}
