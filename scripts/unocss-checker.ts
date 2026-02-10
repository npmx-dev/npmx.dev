import type { Dirent } from 'node:fs'
import { glob, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createGenerator } from 'unocss'
import { presetRtl } from '../uno-preset-rtl.ts'
import { presetA11y } from '../uno-preset-a11y.ts'
import { COLORS } from './utils.ts'
import { presetWind4 } from 'unocss'

const argvFiles = process.argv.slice(2)
const APP_DIRECTORY = fileURLToPath(new URL('../app', import.meta.url))

async function checkFile(path: Dirent): Promise<string | undefined> {
  if (path.isDirectory() || !path.name.endsWith('.vue')) {
    return undefined
  }

  const filename = resolve(APP_DIRECTORY, path.parentPath, path.name)
  const file = await readFile(filename, 'utf-8')
  let idx = -1
  let line: string
  const warnings = new Map<number, string[]>()
  const uno = await createGenerator({
    presets: [
      presetWind4(),
      presetRtl((warning, rule) => {
        let entry = warnings.get(idx)
        if (!entry) {
          entry = []
          warnings.set(idx, entry)
        }
        const ruleIdx = line.indexOf(rule)
        entry.push(
          `${COLORS.red} ❌ [RTL] ${filename}:${idx}${ruleIdx > -1 ? `:${ruleIdx + 1}` : ''} - ${warning}${COLORS.reset}`,
        )
      }),
      presetA11y((warning, rule) => {
        let entry = warnings.get(idx)
        if (!entry) {
          entry = []
          warnings.set(idx, entry)
        }
        const ruleIdx = line.indexOf(rule)
        entry.push(
          `${COLORS.red} ❌ [A11y] ${filename}:${idx}${ruleIdx > -1 ? `:${ruleIdx + 1}` : ''} - ${warning}${COLORS.reset}`,
        )
      }),
    ],
  })
  const lines = file.split('\n')
  for (let i = 0; i < lines.length; i++) {
    idx = i + 1
    line = lines[i]
    await uno.generate(line)
  }

  return warnings.size > 0 ? Array.from(warnings.values()).flat().join('\n') : undefined
}

async function check(): Promise<void> {
  const dir = glob(argvFiles.length > 0 ? argvFiles : '**/*.vue', {
    withFileTypes: true,
    cwd: APP_DIRECTORY,
  })
  let hasErrors = false
  for await (const file of dir) {
    const result = await checkFile(file)
    if (result) {
      hasErrors = true
      // oxlint-disable-next-line no-console -- warn logging
      console.error(result)
    }
  }

  if (hasErrors) {
    process.exit(1)
  } else {
    // oxlint-disable-next-line no-console -- success logging
    console.log(`${COLORS.green}✅ CSS check passed!${COLORS.reset}`)
  }
}

check()
