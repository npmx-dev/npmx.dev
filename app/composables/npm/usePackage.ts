import { transformPackument } from '#shared/utils/packument'

export function usePackage(
  name: MaybeRefOrGetter<string>,
  requestedVersion?: MaybeRefOrGetter<string | null>,
) {
  const asyncData = useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    async ({ $npmRegistry }, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data: r, isStale } = await $npmRegistry<Packument>(`/${encodedName}`, {
        signal,
      })
      const reqVer = toValue(requestedVersion)
      const pkg = transformPackument(r, reqVer)
      return { ...pkg, isStale }
    },
  )

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}
