import type { ModuleReplacement } from 'module-replacements'

export function getReplacementDescription(replacement: ModuleReplacement): string {
  if (replacement.type === 'documented') return ''
  return replacement.description ?? ''
}

export function getReplacementNodeVersion(replacement: ModuleReplacement): string | null {
  const nodeEngine = replacement.engines?.find(e => e.engine === 'nodejs')
  return nodeEngine?.minVersion || null
}
