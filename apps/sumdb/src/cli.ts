import path from 'node:path'
import process from 'node:process'
import { registryCatalog } from '../../../config/registries.ts'
import { collectPublishedKeys, hydrateSourceRegistries } from '../../registry-core/src/index.ts'
import { createSumDbServer } from './server.ts'

const port = Number(process.env.SUMDB_PORT ?? process.env.PORT ?? 4318)
const dataDir = process.env.SUMDB_DATA_DIR ?? path.resolve(process.cwd(), '.data/sumdb')
const allowedRegistryKeys = process.env.ALLOWED_INGEST_REGISTRY_KEYS
  ? process.env.ALLOWED_INGEST_REGISTRY_KEYS.split(',').map(item => item.trim()).filter(Boolean)
  : null

const hydratedRegistries = await hydrateSourceRegistries(registryCatalog)
const trustedResponsibleKeys = collectPublishedKeys(hydratedRegistries)

const { server, keyPair } = await createSumDbServer({
  port,
  dataDir,
  sumDbPrivateKey: process.env.SUMDB_PRIVATE_KEY,
  sumDbPublicKey: process.env.SUMDB_PUBLIC_KEY,
  allowedRegistryKeys,
  trustedResponsibleKeys,
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[sumdb] listening on http://127.0.0.1:${port}`)
  console.log(`[sumdb] key id: ${keyPair.keyId}`)
  console.log(`[sumdb] data dir: ${dataDir}`)
  console.log(`[sumdb] trusted responsible keys: ${trustedResponsibleKeys.length}`)
})
