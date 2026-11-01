#!/usr/bin/env node
import process from 'node:process'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { isThemePreference } from './theme/types.ts'

const MIN_NODE_VERSION: [number, number, number] = [26, 4, 0]
const FFI_FLAG = '--experimental-ffi'
const RESET = '\x1B[0m'
const BOLD = '\x1B[1m'
const RED = '\x1B[31m'
const CYAN = '\x1B[36m'
const DIM = '\x1B[2m'

function readPackageVersion(): string {
  const packageJsonUrl = new URL('../package.json', import.meta.url)
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version?: unknown }

  if (typeof packageJson.version !== 'string' || !packageJson.version) {
    throw new Error('Unable to read npmx-tui version from package.json')
  }

  return packageJson.version
}

function parseNodeVersion(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version
    .replace(/^v/, '')
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0)

  return [major, minor, patch]
}

function isAtLeastVersion(
  actual: [number, number, number],
  minimum: [number, number, number],
): boolean {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) {
      return true
    }

    if (actual[index] < minimum[index]) {
      return false
    }
  }

  return true
}

function assertCompatibleNodeVersion(): void {
  if (isAtLeastVersion(parseNodeVersion(process.version), MIN_NODE_VERSION)) {
    return
  }

  console.error(`
${RED}${BOLD}[npmx-tui] ERROR: Unsupported Node.js runtime${RESET}

${BOLD}Expected:${RESET} Node.js 26.4.0+ with experimental FFI support
${BOLD}Current:${RESET}  ${process.version}

${BOLD}Action:${RESET}   Switch to Node.js 26.4.0+ for the TUI, then rerun this command.
${DIM}Hint:${RESET}     The main npmx.dev app can still use Node.js 24; only npmx-tui needs Node.js 26.
${CYAN}${'='.repeat(64)}${RESET}`)
  process.exit(1)
}

async function ensureExperimentalFfi(): Promise<void> {
  if (process.execArgv.includes(FFI_FLAG)) {
    return
  }

  const child = spawn(process.execPath, [FFI_FLAG, ...process.execArgv, ...process.argv.slice(1)], {
    env: process.env,
    stdio: 'inherit',
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('exit', code => {
      resolve(code ?? 0)
    })
    child.once('error', reject)
  })

  process.exit(exitCode)
}

const { values } = parseArgs({
  options: {
    'help': {
      type: 'boolean',
      short: 'h',
    },
    'version': {
      type: 'boolean',
      short: 'v',
    },
    'theme': {
      type: 'string',
      short: 't',
    },
    'api-base-url': {
      type: 'string',
    },
  },
})

if (values.help) {
  console.log(`npmx-tui

Usage:
  npmx-tui [options]

Options:
  -h, --help     Show help
  -v, --version  Show version
  -t, --theme    Theme preference: system, dark, light
      --api-base-url  npmx backend base URL`)
  process.exit(0)
}

if (values.version) {
  console.log(readPackageVersion())
  process.exit(0)
}

const themePreference = values.theme ?? 'system'

if (!isThemePreference(themePreference)) {
  console.error(`Invalid theme preference: ${themePreference}

Expected one of: system, dark, light`)
  process.exit(1)
}

assertCompatibleNodeVersion()
await ensureExperimentalFfi()

const { runTui } = await import('./index.ts')

runTui({
  version: readPackageVersion(),
  themePreference,
  apiBaseUrl: values['api-base-url'],
}).catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
