import { all, type ModuleReplacement } from 'module-replacements'

export default defineEventHandler((event): ModuleReplacement | null => {
  const pkg = getRouterParam(event, 'pkg')
  if (!pkg) return null
  const mapping = all.mappings[pkg]
  if (!mapping) return null
  const replacementId = mapping.replacements[0]
  if (!replacementId) return null
  return all.replacements[replacementId] ?? null
})
