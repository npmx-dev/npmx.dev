import { all, type ModuleReplacement } from 'module-replacements'

export default defineEventHandler((event): ModuleReplacement[] | null => {
  const pkg = getRouterParam(event, 'pkg')
  if (!pkg) return null
  const mapping = all.mappings[pkg]
  if (!mapping) return null
  const replacements = mapping.replacements.map(r => all.replacements[r]!)
  if (!replacements.length) return null
  return replacements
})
