export function usePackageHasChangelog(
  packageName: MaybeRefOrGetter<string>,
  version?: MaybeRefOrGetter<string | null | undefined>,
) {
  return useLazyFetch<boolean>(
    () => {
      const name = toValue(packageName)
      const ver = toValue(version)
      const base = `/api/changelog/has/${name}`
      return ver ? `${base}/v/${ver}` : base
    },
    {
      onResponse(r) {
        console.log({ r })
      },
    },
  )
}
