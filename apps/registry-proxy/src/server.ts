import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { URL } from 'node:url'
import {
  createArtifactDigest,
  createRegistryIdentity,
  hydrateSourceRegistries,
  npmKeyToPublicKeyPem,
  publicKeyPemToNpmKey,
  resolveSourceRegistry,
  stableStringify,
  type ConfiguredSourceRegistry,
  type IngestRecord,
  type RegistryIdentity,
  type SourceRegistry,
} from '../../registry-core/src/index.ts'
import { generateRegistryKeyPair } from '../../registry-core/src/crypto.ts'

interface ProxyServerOptions {
  port: number
  baseUrl: string
  upstreamBaseUrl?: string
  sourceRegistries?: ConfiguredSourceRegistry[]
  cacheDir: string
  sumDbBaseUrl?: string
  registryPrivateKey?: string
  registryPublicKey?: string
}

type VerifiedVersionSignature = {
  integrity: string
  upstreamSignature: string
  responsibleKeyId: string
}

function createRequestId(): string {
  return crypto.randomUUID()
}

function sanitizeCacheSegment(value: string): string {
  // npm-style key IDs contain characters like "/" and ":" that are valid in identifiers
  // but unsafe in filenames, so cache paths must normalize them.
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, '_')
}

function cachePathForRegistry(cacheDir: string, registryLabel: string, packageName: string): string {
  return path.join(
    cacheDir,
    `${sanitizeCacheSegment(registryLabel)}__${sanitizeCacheSegment(packageName)}.json`,
  )
}

function isPackumentPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  return parts.length === 1 || (parts.length === 2 && parts[0]?.startsWith('@'))
}

function parseTarballRequest(pathname: string): { packageName: string; version: string } | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 3 && parts[1] === '-') {
    const packageName = decodeURIComponent(parts[0]!)
    const filename = decodeURIComponent(parts[2]!)
    const prefix = `${packageName}-`
    if (!filename.startsWith(prefix) || !filename.endsWith('.tgz')) {
      return null
    }

    return {
      packageName,
      version: filename.slice(prefix.length, -4),
    }
  }

  if (parts.length === 4 && parts[0]?.startsWith('@') && parts[2] === '-') {
    const scope = decodeURIComponent(parts[0]!)
    const name = decodeURIComponent(parts[1]!)
    const packageName = `${scope}/${name}`
    const filename = decodeURIComponent(parts[3]!)
    const prefix = `${name}-`
    if (!filename.startsWith(prefix) || !filename.endsWith('.tgz')) {
      return null
    }

    return {
      packageName,
      version: filename.slice(prefix.length, -4),
    }
  }

  return null
}

function parsePackageName(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 1) {
    return decodeURIComponent(parts[0]!)
  }
  if (parts.length === 2 && parts[0]?.startsWith('@')) {
    return `${decodeURIComponent(parts[0]!)}\/${decodeURIComponent(parts[1]!)}`
  }
  return null
}

function rewritePackumentTarballs(packument: Record<string, unknown>): Record<string, unknown> {
  const cloned = structuredClone(packument)
  // We intentionally leave tarball URLs pointing at the source registry. The proxy still
  // observes and checkpoints installs, but lockfiles should record the origin URL.
  return cloned
}

async function ingestRecord(sumDbBaseUrl: string | undefined, record: IngestRecord) {
  if (!sumDbBaseUrl) {
    return { checkpointed: false, reason: 'SUMDB_BASE_URL not configured' }
  }

  try {
    const response = await fetch(`${sumDbBaseUrl}/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: stableStringify(record),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      return {
        checkpointed: false,
        reason: `sumdb returned ${response.status}${errorBody ? `: ${errorBody.trim()}` : ''}`,
      }
    }

    return {
      checkpointed: true,
      reason: 'ingested',
    }
  } catch (error) {
    return {
      checkpointed: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function verifyVersionSignature(input: {
  packageName: string
  version: string
  versionMetadata: Record<string, unknown>
  sourceRegistry: SourceRegistry
}): VerifiedVersionSignature | null {
  const dist = input.versionMetadata.dist
  if (!dist || typeof dist !== 'object') {
    return null
  }

  const typedDist = dist as Record<string, unknown>
  const integrity = typedDist.integrity
  if (typeof integrity !== 'string' || !integrity) {
    return null
  }

  const signatures = Array.isArray(typedDist.signatures)
    ? (typedDist.signatures as Array<Record<string, unknown>>)
    : []
  if (signatures.length === 0) {
    return null
  }

  for (const entry of signatures) {
    const keyId = typeof entry?.keyid === 'string' ? entry.keyid : undefined
    const upstreamSignature = typeof entry?.sig === 'string' ? entry.sig : undefined
    if (!keyId || !upstreamSignature) {
      continue
    }

    const matchingKey = input.sourceRegistry.npmKeys.find(key => key.keyid === keyId)
    if (!matchingKey) {
      continue
    }

    // npm signs `${name}@${version}:${dist.integrity}`. We verify exactly that string against
    // the key set published by the chosen source registry.
    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${input.packageName}@${input.version}:${integrity}`),
      npmKeyToPublicKeyPem(matchingKey),
      Buffer.from(upstreamSignature, 'base64'),
    )
    if (verified) {
      // We treat each published key independently, so the logged record is bound to the
      // exact key that signed the package version rather than to a registry-level placeholder.
      return {
        integrity,
        upstreamSignature,
        responsibleKeyId: keyId,
      }
    }
  }

  return null
}

async function fetchPackument(packageName: string, sourceRegistry: SourceRegistry) {
  const encodedPackageName = packageName.startsWith('@')
    ? packageName.replace('/', '%2f')
    : packageName

  const upstreamResponse = await fetch(`${sourceRegistry.registryBaseUrl}/${encodedPackageName}`)
  if (!upstreamResponse.ok) {
    throw new Error(`upstream returned ${upstreamResponse.status}`)
  }

  return (await upstreamResponse.json()) as Record<string, unknown>
}

function getVersionMetadata(packument: Record<string, unknown>, version: string) {
  const versions = packument.versions
  if (!versions || typeof versions !== 'object') {
    return null
  }

  const versionMetadata = (versions as Record<string, unknown>)[version]
  if (!versionMetadata || typeof versionMetadata !== 'object') {
    return null
  }

  return versionMetadata as Record<string, unknown>
}

async function fetchAndIngestTarball(input: {
  packageName: string
  version: string
  tarballUrl: string
  verifiedSignature: VerifiedVersionSignature
  sumDbBaseUrl?: string
}) {
  const response = await fetch(input.tarballUrl)
  if (!response.ok) {
    throw new Error(`Unable to fetch tarball ${input.tarballUrl}: ${response.status}`)
  }

  const body = Buffer.from(await response.arrayBuffer())
  const record: IngestRecord = {
    keyId: input.verifiedSignature.responsibleKeyId,
    name: input.packageName,
    version: input.version,
    type: 'tarball',
    digest: createArtifactDigest(body),
    size: body.byteLength,
    url: input.tarballUrl,
    integrity: input.verifiedSignature.integrity,
    signature: input.verifiedSignature.upstreamSignature,
  }
  const ingestResult = await ingestRecord(input.sumDbBaseUrl, record)

  console.log(
    `[proxy] tarball ${input.packageName}@${input.version} checkpointed=${ingestResult.checkpointed} reason=${ingestResult.reason}`,
  )
}

async function ensureInstallTarballRecorded(input: {
  packageName: string
  packument: Record<string, unknown>
  sourceRegistry: SourceRegistry
  sumDbBaseUrl?: string
}) {
  // npm installs typically fetch a packument before the tarball itself. We proactively try to
  // checkpoint the latest tagged tarball here so sumdb logging does not depend on npm reusing
  // the proxy for the subsequent tarball download.
  const distTags = input.packument['dist-tags']
  if (!distTags || typeof distTags !== 'object') {
    return
  }

  const latestVersion = (distTags as Record<string, unknown>).latest
  if (typeof latestVersion !== 'string') {
    return
  }

  const versionMetadata = getVersionMetadata(input.packument, latestVersion)
  if (!versionMetadata) {
    return
  }

  const verifiedSignature = verifyVersionSignature({
    packageName: input.packageName,
    version: latestVersion,
    versionMetadata,
    sourceRegistry: input.sourceRegistry,
  })
  if (!verifiedSignature) {
    return
  }

  const dist = versionMetadata.dist as Record<string, unknown>
  const tarballUrl = dist.tarball
  if (typeof tarballUrl !== 'string') {
    return
  }

  await fetchAndIngestTarball({
    packageName: input.packageName,
    version: latestVersion,
    tarballUrl,
    verifiedSignature,
    sumDbBaseUrl: input.sumDbBaseUrl,
  })
}

async function writePackumentCache(cacheDir: string, registryLabel: string, packageName: string, body: string) {
  await fs.mkdir(cacheDir, { recursive: true })
  await fs.writeFile(cachePathForRegistry(cacheDir, registryLabel, packageName), body)
}

async function readPackumentCache(cacheDir: string, registryLabel: string, packageName: string): Promise<string | null> {
  try {
    return await fs.readFile(cachePathForRegistry(cacheDir, registryLabel, packageName), 'utf8')
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function sendJson(response: http.ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(`${stableStringify(body)}\n`)
}

function sendError(response: http.ServerResponse, statusCode: number, message: string) {
  sendJson(response, statusCode, { error: message })
}

export async function createRegistryProxyServer(options: ProxyServerOptions) {
  const keyPair =
    options.registryPrivateKey && options.registryPublicKey
      ? {
          privateKeyPem: options.registryPrivateKey,
          publicKeyPem: options.registryPublicKey,
          npmKey: publicKeyPemToNpmKey(options.registryPublicKey),
        }
      : generateRegistryKeyPair()

  const identity = createRegistryIdentity({
    publicKey: keyPair.publicKeyPem,
    baseUrl: options.baseUrl,
    upstreamBaseUrl: options.upstreamBaseUrl ?? 'https://registry.npmjs.org',
  })

  const sourceRegistries = await hydrateSourceRegistries(options.sourceRegistries ?? [], options.upstreamBaseUrl)

  const server = http.createServer(async (request, response) => {
    const method = request.method ?? 'GET'
    const url = new URL(request.url ?? '/', options.baseUrl)
    const pathname = url.pathname

    if (method === 'GET' && pathname === '/-/npm/v1/keys') {
      sendJson(response, 200, {
        keys: [keyPair.npmKey],
      })
      return
    }

    if (method !== 'GET') {
      sendError(response, 405, `Unsupported method ${method}`)
      return
    }

    try {
      const tarballRequest = parseTarballRequest(pathname)
      if (tarballRequest) {
        const sourceRegistry = resolveSourceRegistry(sourceRegistries)
        const requestId = createRequestId()
        const upstreamTarballUrl = `${sourceRegistry.registryBaseUrl}${pathname}`
        const upstreamResponse = await fetch(upstreamTarballUrl)
        if (!upstreamResponse.ok || !upstreamResponse.body) {
          sendError(response, upstreamResponse.status || 502, `Unable to fetch ${upstreamTarballUrl}`)
          return
        }

        response.statusCode = upstreamResponse.status
        response.setHeader(
          'content-type',
          upstreamResponse.headers.get('content-type') ?? 'application/octet-stream',
        )
        const contentLength = upstreamResponse.headers.get('content-length')
        if (contentLength) {
          response.setHeader('content-length', contentLength)
        }
        response.setHeader('x-npmx-request-id', requestId)

        const chunks: Buffer[] = []
        for await (const chunk of upstreamResponse.body) {
          const buffer = Buffer.from(chunk)
          chunks.push(buffer)
          response.write(buffer)
        }
        response.end()

        const body = Buffer.concat(chunks)
        const packument = await fetchPackument(tarballRequest.packageName, sourceRegistry)
        const versionMetadata = getVersionMetadata(packument, tarballRequest.version)
        const verifiedSignature =
          versionMetadata &&
          verifyVersionSignature({
            packageName: tarballRequest.packageName,
            version: tarballRequest.version,
            versionMetadata,
            sourceRegistry,
          })

        if (!verifiedSignature) {
          console.log(`[proxy] tarball ${tarballRequest.packageName}@${tarballRequest.version} checkpointed=false reason=signature verification failed`)
          return
        }

        const record: IngestRecord = {
          keyId: verifiedSignature.responsibleKeyId,
          name: tarballRequest.packageName,
          version: tarballRequest.version,
          type: 'tarball',
          digest: createArtifactDigest(body),
          size: body.byteLength,
          url: upstreamTarballUrl,
          integrity: verifiedSignature.integrity,
          signature: verifiedSignature.upstreamSignature,
        }
        const ingestResult = await ingestRecord(options.sumDbBaseUrl, record)

        console.log(
          `[proxy] tarball ${tarballRequest.packageName}@${tarballRequest.version} checkpointed=${ingestResult.checkpointed} reason=${ingestResult.reason}`,
        )
        return
      }

      if (!isPackumentPath(pathname)) {
        sendError(response, 404, `Unsupported path ${pathname}`)
        return
      }

      const packageName = parsePackageName(pathname)
      if (!packageName) {
        sendError(response, 400, `Invalid package path ${pathname}`)
        return
      }
      const sourceRegistry = resolveSourceRegistry(sourceRegistries)

      const requestId = createRequestId()
      let body: string | null = null
      try {
        const upstreamPackument = await fetchPackument(packageName, sourceRegistry)
        await ensureInstallTarballRecorded({
          packageName,
          packument: upstreamPackument,
          sourceRegistry,
          sumDbBaseUrl: options.sumDbBaseUrl,
        })

        const rewritten = rewritePackumentTarballs(upstreamPackument)
        body = `${stableStringify(rewritten)}\n`
        await writePackumentCache(options.cacheDir, sourceRegistry.label, packageName, body)
      } catch (error) {
        body = await readPackumentCache(options.cacheDir, sourceRegistry.label, packageName)
        if (!body) {
          throw error
        }
      }

      response.statusCode = 200
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.setHeader('x-npmx-request-id', requestId)
      response.end(body)

      console.log(`[proxy] packument ${packageName} request=${requestId}`)
    } catch (error) {
      sendError(response, 500, error instanceof Error ? error.message : String(error))
    }
  })

  return {
    server,
    port: options.port,
    identity,
    sourceRegistries,
    keyPair,
  }
}
