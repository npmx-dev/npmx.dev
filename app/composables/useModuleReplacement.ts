export function useModuleReplacement(packageName: MaybeRefOrGetter<string>) {
  return useLazyAsyncData(
    () => `module-replacement:${toValue(packageName)}`,
    () => fetchModuleReplacement(toValue(packageName)),
  )
}
