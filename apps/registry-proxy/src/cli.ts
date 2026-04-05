import path from 'node:path'
import process from 'node:process'
import type { NpmKey } from '../../registry-core/src/index.ts'
import { registryCatalog } from '../../../config/registries.ts'
import { createRegistryProxyServer } from './server.ts'

const port = Number(process.env.PROXY_PORT ?? process.env.PORT ?? 4317)
const baseUrl = process.env.PROXY_BASE_URL ?? `http://127.0.0.1:${port}`
const upstreamBaseUrl = process.env.UPSTREAM_NPM_REGISTRY ?? 'https://registry.npmjs.org'
const cacheDir = process.env.PROXY_CACHE_DIR ?? path.resolve(process.cwd(), '.data/proxy-cache')
const sumDbBaseUrl = process.env.SUMDB_BASE_URL
const sourceRegistries = process.env.SOURCE_REGISTRIES_JSON
  ? (JSON.parse(process.env.SOURCE_REGISTRIES_JSON) as Array<{
      label: string
      registryBaseUrl: string
      npmKeys?: NpmKey[]
    }>)
  // The checked-in catalog is the normal source of truth; the env var is just an escape hatch
  // for experiments without editing repo config.
  : registryCatalog

const { server, identity, sourceRegistries: resolvedSourceRegistries } = await createRegistryProxyServer({
  port,
  baseUrl,
  upstreamBaseUrl,
  sourceRegistries,
  cacheDir,
  sumDbBaseUrl,
  registryPrivateKey: process.env.REGISTRY_PRIVATE_KEY,
  registryPublicKey: process.env.REGISTRY_PUBLIC_KEY,
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[proxy] listening on ${baseUrl}`)
  console.log(`[proxy] registry key id: ${identity.keyId}`)
  console.log(
    `[proxy] source registries: ${resolvedSourceRegistries.map(registry => `${registry.label}=${registry.registryBaseUrl}`).join(', ')}`,
  )
  console.log(`[proxy] cache dir: ${cacheDir}`)
  console.log(`[proxy] sumdb: ${sumDbBaseUrl ?? 'disabled'}`)
})
