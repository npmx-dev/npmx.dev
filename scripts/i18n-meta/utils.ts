import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import type { EnJson, EnMetaJson } from './types.d.ts'

export function getCurrentCommitHash() {
  return git('rev-parse HEAD')
}

export function getNewEnJson(enJsonPath: string): EnJson {
  if (fs.existsSync(enJsonPath)) {
    return readJson<EnJson>(enJsonPath)
  }
  return {} as EnJson
}

export function getOldEnMetaJson(enMetaJsonPath: string): EnMetaJson {
  if (fs.existsSync(enMetaJsonPath)) {
    return readJson<EnMetaJson>(enMetaJsonPath)
  }
  return {} as EnMetaJson
}

export function checkTranslationChanges(oldMeta: EnMetaJson, newMeta: EnMetaJson): boolean {
  const oldObj = omitMeta(oldMeta)
  const newObj = omitMeta(newMeta)
  return JSON.stringify(oldObj) !== JSON.stringify(newObj)
}

export function createUpdatedEnMetaJson(commitHash: string, content: EnMetaJson): EnMetaJson {
  return {
    $meta: {
      last_updated_commit: commitHash,
      updated_at: new Date().toISOString(),
    },
    ...omitMeta(content),
  }
}

function git(command: string) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf-8' }).trim()
  } catch {
    console.error(`🚨 Git command failed: git ${command}`)
    return null
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
}

function omitMeta<T extends object>(obj: T): Omit<T, '$meta'> {
  const { $meta: _, ...rest } = obj as T & { $meta?: unknown }
  return rest
}
