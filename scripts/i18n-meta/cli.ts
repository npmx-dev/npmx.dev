import { parseArgs } from 'node:util'
import { updateEnMetaJson } from './update-en-meta-json.ts'

function showHelp() {
  const scriptName = process.env.npm_lifecycle_event || 'node scripts/i18n-meta/cli.ts'
  console.log(`Usage: pnpm run ${scriptName} update-en-meta`)
}

function main() {
  const { positionals } = parseArgs({ allowPositionals: true })

  if (positionals[0] !== 'update-en-meta') {
    showHelp()
    return
  }

  updateEnMetaJson()
}

main()
