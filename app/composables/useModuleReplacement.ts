import type { ModuleReplacement, ModuleReplacementMapping } from 'module-replacements'

export function useModuleReplacement(packageName: MaybeRefOrGetter<string | undefined>) {
  return useLazyFetch<{ mapping: ModuleReplacementMapping; replacement: ModuleReplacement } | null>(
    () => {
      const pkg = toValue(packageName)
      if (!pkg) return ''
      return `/api/replacements/${encodeURIComponent(pkg)}`
    },
  )
}
