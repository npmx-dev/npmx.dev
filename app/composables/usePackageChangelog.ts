import type { ChangelogInfo } from '~~/shared/types/changelog'

const KEY = 'changelog:has:info'

export function usePackageChangelog(
  packageName: MaybeRefOrGetter<string>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<ChangelogInfo | null>(() => {
    const name = toValue(packageName)
    const ver = toValue(version)
    return `/api/changelog/info/${name}/v/${ver || 'latest'}`
  })
}

/**
 * check whether the current package & version has changelogs
 * @param setState with `useState` also set the state of `changelog:info` (currently only for packageHeader)
 */
export function usePackageHasChangelog(
  packageName: MaybeRefOrGetter<string>,
  version?: MaybeRefOrGetter<string | null | undefined>,
  setState?: boolean,
) {
  const { data } = usePackageChangelog(packageName, version)
  const hasChangelog = computed(() => data.value?.type == 'md' || data.value?.type == 'release')
  if (setState) {
    useState(KEY, () => hasChangelog)
  }
  return hasChangelog
}

/**
 * get whether current package has changelog via `useState` (is needed for command pallette)
 */
export function usePackageHasChangelogFromState() {
  return useState<boolean>(KEY)
}
