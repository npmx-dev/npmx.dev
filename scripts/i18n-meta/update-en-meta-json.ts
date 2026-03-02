import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import dot from 'dot-object'
import {
  checkTranslationChanges,
  createUpdatedEnMetaJson,
  getCurrentCommitHash,
  getNewEnJson,
  getOldEnMetaJson,
} from './utils.ts'
import type { EnJson, EnMetaJson, MetaEntry } from './types.d.ts'

const enJsonPath = resolve('i18n/locales/en.json')
const enMetaJsonPath = resolve('i18n/locales/en.meta.json')

/**
 * Update a metadata JSON file for English translations.
 */
export function updateEnMetaJson() {
  const newEnJson = getNewEnJson(enJsonPath)
  const oldEnMetaJson = getOldEnMetaJson(enMetaJsonPath)

  const currentCommitHash = getCurrentCommitHash()
  if (!currentCommitHash) {
    console.error('❌ Commit hash missing. Skipping update to protect existing metadata.')
    process.exit(1)
  }
  const enMetaJson = makeEnMetaJson(oldEnMetaJson, newEnJson, currentCommitHash)

  const hasChanges = checkTranslationChanges(oldEnMetaJson, enMetaJson)
  if (!hasChanges) {
    console.info('ℹ️ No translation changes – en.meta.json left untouched')
    return
  }

  const updatedEnMetaJson = createUpdatedEnMetaJson(currentCommitHash, enMetaJson)

  writeFileSync(enMetaJsonPath, JSON.stringify(updatedEnMetaJson, null, 2) + '\n', 'utf-8')
  console.log(`✅ Updated en.meta.json – last_updated_commit: ${currentCommitHash}`)
}

export function makeEnMetaJson(
  oldMetaEnJson: EnMetaJson,
  newEnJson: EnJson,
  latestCommitHash: string,
): EnMetaJson {
  const newFlat = dot.dot(newEnJson) as Record<string, string>
  const oldMetaFlat = dot.dot(oldMetaEnJson) as Record<string, string>
  const metaFlat: Record<string, MetaEntry> = {}

  for (const key in newFlat) {
    const newText = newFlat[key]

    const lastSeenText = oldMetaFlat[`${key}.text`]
    const lastCommit = oldMetaFlat[`${key}.commit`]

    if (newText === lastSeenText) {
      metaFlat[key] = { text: newText, commit: lastCommit ?? latestCommitHash }
    } else {
      metaFlat[key] = { text: newText, commit: latestCommitHash }
    }
  }
  return dot.object(metaFlat) as EnMetaJson
}
