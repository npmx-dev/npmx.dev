import { all, type ModuleReplacement, type ModuleReplacementMapping } from 'module-replacements'

export default defineEventHandler(
  (event): { mapping: ModuleReplacementMapping; replacement: ModuleReplacement } | null => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) return null
    if (!Object.hasOwn(all.mappings, pkg)) return null
    const mapping = all.mappings[pkg]
    if (!mapping) return null
    const replacementId = mapping.replacements[0]
    if (!replacementId) return null
    const replacement = all.replacements[replacementId]
    if (!replacement) return null
    return { mapping, replacement }
  },
)
