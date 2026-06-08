import type { ChangelogInfo } from '~~/shared/types/changelog'

export function usePackageChangelog(
  packageName: MaybeRefOrGetter<string | null | undefined>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  const name = computed(() => toValue(packageName)?.trim() || '')
  const ver = computed(() => toValue(version) || 'latest')

  return useLazyAsyncData<ChangelogInfo | null>(
    () => `package-changelog:${name.value}:${ver.value}`,
    async (_, { signal }) => {
      if (!name.value) {
        return null
      }
      return $fetch<ChangelogInfo | null>(`/api/changelog/info/${name.value}/v/${ver.value}`, {
        signal,
      })
    },
    { default: () => null, watch: [name, ver] },
  )
}
