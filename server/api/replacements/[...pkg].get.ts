import { all, type ModuleReplacement, type ModuleReplacementMapping } from 'module-replacements'

export default defineEventHandler((event): any => {
  const pkg = getRouterParam(event, 'pkg')
  if (!pkg) return null

  // Support batch query via comma-separated list
  if (pkg.includes(',')) {
    const names = pkg.split(',')
    const results: Record<
      string,
      { mapping: ModuleReplacementMapping; replacement: ModuleReplacement }
    > = {}
    for (const name of names) {
      const decodedName = decodeURIComponent(name)
      if (Object.hasOwn(all.mappings, decodedName)) {
        const mapping = all.mappings[decodedName]
        if (mapping) {
          const replacementId = mapping.replacements[0]
          if (replacementId) {
            const replacement = all.replacements[replacementId]
            if (replacement) {
              results[decodedName] = { mapping, replacement }
            }
          }
        }
      }
    }
    return results
  }

  // Single query (backward compatible)
  const decodedName = decodeURIComponent(pkg)
  if (!Object.hasOwn(all.mappings, decodedName)) return null
  const mapping = all.mappings[decodedName]
  if (!mapping) return null
  const replacementId = mapping.replacements[0]
  if (!replacementId) return null
  const replacement = all.replacements[replacementId]
  if (!replacement) return null
  return { mapping, replacement }
})
