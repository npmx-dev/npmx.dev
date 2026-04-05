import process from 'node:process'
import { verifyPackageFromSumDb } from './verify-lib.ts'

function parseArgs(argv: string[]) {
  const args = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value) continue
    args.set(key.slice(2), value)
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const sumDbBaseUrl = args.get('sumdb-base-url') ?? 'http://127.0.0.1:4318'
const registryKeyId = args.get('registry-key-id')
const packageName = args.get('package')
const version = args.get('version')
const tarballPath = args.get('tarball-path')

if (!registryKeyId || !packageName || !version) {
  console.error(
    'Usage: node --experimental-strip-types apps/demo/src/verify.ts --registry-key-id <id> --package <name> --version <version> [--sumdb-base-url <url>] [--tarball-path <path>]',
  )
  process.exit(1)
}

const result = await verifyPackageFromSumDb({
  sumDbBaseUrl,
  registryKeyId,
  packageName,
  version,
  tarballPath,
})

console.log(JSON.stringify(result, null, 2))
