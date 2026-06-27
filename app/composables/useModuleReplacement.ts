import type { ModuleReplacement, ModuleReplacementMapping } from 'module-replacements'

export function useModuleReplacement(packageName: MaybeRefOrGetter<string>) {
  return useLazyFetch<{ mapping: ModuleReplacementMapping; replacement: ModuleReplacement } | null>(
    () => `/api/replacements/${toValue(packageName)}`,
  )
}
