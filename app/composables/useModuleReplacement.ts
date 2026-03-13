import type { ModuleReplacement } from 'module-replacements'

export function useModuleReplacement(packageName: MaybeRefOrGetter<string>) {
  return useLazyFetch<ModuleReplacement | null>(() => `/api/replacements/${toValue(packageName)}`)
}
