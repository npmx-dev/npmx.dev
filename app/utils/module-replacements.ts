export function getReplacementDescription(replacement: ModuleReplacement) {
  if (replacement.type === 'documented') return ''
  return replacement.description ?? ''
}

export function getReplacementNodeVersion(replacement: ModuleReplacement) {
  const nodeEngine = replacement.engines?.find(e => e.engine === 'nodejs')
  return nodeEngine?.minVersion || null
}
