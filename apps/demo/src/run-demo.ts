import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { generateRegistryKeyPair } from '../../registry-core/src/index.ts'

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawn(command, args, {
    stdio: 'inherit',
    env,
  })
}

const cwd = process.cwd()
const sumDbPort = process.env.SUMDB_PORT ?? '4318'
const proxyPort = process.env.PROXY_PORT ?? '4317'
const sumDbKeys =
  process.env.SUMDB_PRIVATE_KEY && process.env.SUMDB_PUBLIC_KEY
    ? {
        privateKeyPem: process.env.SUMDB_PRIVATE_KEY,
        publicKeyPem: process.env.SUMDB_PUBLIC_KEY,
      }
    : generateRegistryKeyPair()
const proxyKeys =
  process.env.REGISTRY_PRIVATE_KEY && process.env.REGISTRY_PUBLIC_KEY
    ? {
        privateKeyPem: process.env.REGISTRY_PRIVATE_KEY,
        publicKeyPem: process.env.REGISTRY_PUBLIC_KEY,
      }
    : generateRegistryKeyPair()

console.log('Starting sumdb and registry proxy for the demo.')
console.log(`sumdb: http://127.0.0.1:${sumDbPort}`)
console.log(`proxy: http://127.0.0.1:${proxyPort}`)
console.log('')
console.log('Provide SUMDB_PRIVATE_KEY / SUMDB_PUBLIC_KEY and REGISTRY_PRIVATE_KEY / REGISTRY_PUBLIC_KEY to keep stable identities across restarts.')

const sumDb = run(
  process.execPath,
  ['--experimental-strip-types', path.resolve(cwd, 'apps/sumdb/src/cli.ts')],
  {
    ...process.env,
    PORT: sumDbPort,
    SUMDB_PRIVATE_KEY: sumDbKeys.privateKeyPem,
    SUMDB_PUBLIC_KEY: sumDbKeys.publicKeyPem,
    REGISTRY_PUBLIC_KEY: proxyKeys.publicKeyPem,
  },
)

const proxy = run(
  process.execPath,
  ['--experimental-strip-types', path.resolve(cwd, 'apps/registry-proxy/src/cli.ts')],
  {
    ...process.env,
    PORT: proxyPort,
    PROXY_BASE_URL: `http://127.0.0.1:${proxyPort}`,
    SUMDB_BASE_URL: `http://127.0.0.1:${sumDbPort}`,
    REGISTRY_PRIVATE_KEY: proxyKeys.privateKeyPem,
    REGISTRY_PUBLIC_KEY: proxyKeys.publicKeyPem,
  },
)

process.on('SIGINT', () => {
  sumDb.kill('SIGINT')
  proxy.kill('SIGINT')
  process.exit(0)
})

console.log('')
console.log(`Next step:`)
console.log(`npm install --registry=http://127.0.0.1:${proxyPort} is-number`)
