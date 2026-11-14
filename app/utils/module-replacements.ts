import type { ModuleReplacement } from 'module-replacements'
import type { ModuleReplacementResponse } from '#shared/utils/module-replacements'

/**
 * Fetch the module replacement for `name`. Packages without one resolve to `null` without a request;
 * in the browser the data comes from static files generated at build time.
 */
export async function fetchModuleReplacement(
  name: string,
): Promise<ModuleReplacementResponse | null> {
  const { replacementNames, replacementsBaseURL } = await import('#module-replacements')
  if (!replacementNames.has(name)) return null
  if (import.meta.server) {
    const { getModuleReplacement } = await import('#shared/utils/module-replacements')
    return getModuleReplacement(name)
  }
  return $fetch<ModuleReplacementResponse>(`${replacementsBaseURL}/${name}.json`)
}

export function getReplacementDescription(replacement: ModuleReplacement): string {
  if (replacement.type === 'documented') return ''
  return replacement.description ?? ''
}

export function getReplacementNodeVersion(replacement: ModuleReplacement): string | null {
  const nodeEngine = replacement.engines?.find(e => e.engine === 'nodejs')
  return nodeEngine?.minVersion || null
}
