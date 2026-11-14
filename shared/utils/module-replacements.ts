import { all, type ModuleReplacement, type ModuleReplacementMapping } from 'module-replacements'

export interface ModuleReplacementResponse {
  mapping: ModuleReplacementMapping
  replacement: ModuleReplacement
}

export function getModuleReplacement(name: string): ModuleReplacementResponse | null {
  const mapping = Object.hasOwn(all.mappings, name) ? all.mappings[name] : undefined
  const replacementId = mapping?.replacements[0]
  const replacement = replacementId ? all.replacements[replacementId] : undefined
  return mapping && replacement ? { mapping, replacement } : null
}
