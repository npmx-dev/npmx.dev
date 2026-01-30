import { all, type ModuleReplacement } from 'module-replacements'

const replacementMap = new Map<string, ModuleReplacement>(
  all.moduleReplacements.map(r => [r.moduleName, r]),
)

export default defineEventHandler((event): ModuleReplacement | null => {
  const pkg = getRouterParam(event, 'pkg')
  if (!pkg) return null
  return replacementMap.get(pkg) ?? null
})
