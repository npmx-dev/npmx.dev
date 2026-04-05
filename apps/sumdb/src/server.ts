import http from 'node:http'
import { URL } from 'node:url'
import { generateRegistryKeyPair } from '../../registry-core/src/index.ts'
import {
  deriveKeyId,
  publicKeyPemToNpmKey,
  stableStringify,
  type IngestRecord,
  type NpmKey,
} from '../../registry-core/src/index.ts'
import { SumDbStore } from './store.ts'

interface SumDbServerOptions {
  port: number
  dataDir: string
  sumDbPrivateKey?: string
  sumDbPublicKey?: string
  allowedRegistryKeys: string[] | null
  trustedResponsibleKeys: NpmKey[]
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${stableStringify(body)}\n`)
}

function sendError(response: http.ServerResponse, statusCode: number, message: string) {
  sendJson(response, statusCode, {
    error: message,
  })
}

async function readJsonBody<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

function parseLookupPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 4 || parts[0] !== 'lookup') {
    return null
  }

  return {
    keyId: decodeURIComponent(parts[1]!),
    name: decodeURIComponent(parts.slice(2, -1).join('/')),
    version: decodeURIComponent(parts.at(-1)!),
  }
}

export async function createSumDbServer(options: SumDbServerOptions) {
  const keyPair =
    options.sumDbPrivateKey && options.sumDbPublicKey
      ? {
          privateKeyPem: options.sumDbPrivateKey,
          publicKeyPem: options.sumDbPublicKey,
          keyId: deriveKeyId(options.sumDbPublicKey),
          npmKey: publicKeyPemToNpmKey(options.sumDbPublicKey),
        }
      : generateRegistryKeyPair()

  // The sumdb signs checkpoints with npm-style key material, but it only consumes trusted
  // responsible public keys that are fed into it at startup.
  const store = new SumDbStore({
    dataDir: options.dataDir,
    sumDbPrivateKey: keyPair.privateKeyPem,
    sumDbPublicKey: keyPair.publicKeyPem,
    sumDbKeyId: keyPair.keyId,
    allowedRegistryKeys: options.allowedRegistryKeys,
    trustedResponsibleKeys: options.trustedResponsibleKeys,
  })

  await store.load()
  store.latestCheckpoint()
  await store.save()

  const server = http.createServer(async (request, response) => {
    try {
      const method = request.method ?? 'GET'
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)
      const pathname = url.pathname

      if (method === 'GET' && pathname === '/') {
        sendJson(response, 200, {
          service: 'sum.npmx.dev',
          publicKey: keyPair.publicKeyPem,
          keyId: keyPair.keyId,
          keys: [keyPair.npmKey],
          latestCheckpoint: store.latestCheckpoint(),
        })
        return
      }

      if (method === 'GET' && pathname === '/latest-checkpoint') {
        sendJson(response, 200, store.latestCheckpoint())
        return
      }

      if (method === 'GET' && pathname.startsWith('/checkpoint/')) {
        const treeSize = Number(pathname.replace('/checkpoint/', ''))
        const checkpoint = store.getCheckpointByTreeSize(treeSize)
        if (!checkpoint) {
          sendError(response, 404, `Checkpoint for tree size ${treeSize} was not found`)
          return
        }
        sendJson(response, 200, checkpoint)
        return
      }

      if (method === 'POST' && pathname === '/ingest') {
        const record = await readJsonBody<IngestRecord>(request)
        const result = await store.ingest(record)
        sendJson(response, 201, result)
        return
      }

      const lookup = parseLookupPath(pathname)
      if (method === 'GET' && lookup) {
        sendJson(response, 200, store.lookup(lookup.keyId, lookup.name, lookup.version))
        return
      }

      if (method === 'GET' && pathname.startsWith('/tile/')) {
        const [, , levelRaw, indexRaw] = pathname.split('/')
        const tile = store.getTile(Number(levelRaw), Number(indexRaw))
        if (!tile) {
          sendError(response, 404, `Tile ${levelRaw}/${indexRaw} does not exist`)
          return
        }
        sendJson(response, 200, {
          level: Number(levelRaw),
          index: Number(indexRaw),
          hash: tile,
        })
        return
      }

      if (method === 'GET' && pathname.startsWith('/proof/inclusion/')) {
        const leafIndex = Number(pathname.replace('/proof/inclusion/', ''))
        const treeSize = Number(url.searchParams.get('treeSize') ?? store.latestCheckpoint().treeSize)
        sendJson(response, 200, store.getInclusionProof(leafIndex, treeSize))
        return
      }

      if (method === 'GET' && pathname.startsWith('/proof/consistency/')) {
        const [, , , fromRaw, toRaw] = pathname.split('/')
        sendJson(response, 200, store.getConsistencyProof(Number(fromRaw), Number(toRaw)))
        return
      }

      sendError(response, 404, `Unknown route ${method} ${pathname}`)
    } catch (error) {
      sendError(response, 500, error instanceof Error ? error.message : String(error))
    }
  })

  return {
    server,
    port: options.port,
    keyPair,
    store,
  }
}
