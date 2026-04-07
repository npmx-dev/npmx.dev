import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import {
  collectPublishedKeys,
  createArtifactDigest,
  createPackageSignatureText,
  fetchRegistryKeys,
  generateRegistryKeyPair,
  hydrateSourceRegistries,
  resolveSourceRegistry,
  signText,
  type ConfiguredSourceRegistry,
  type NpmKey,
} from '../../registry-core/src/index.ts'
import { createRegistryProxyServer } from '../../registry-proxy/src/server.ts'
import { createSumDbServer } from '../../sumdb/src/server.ts'
import { verifyPackageFromSumDb } from './verify-lib.ts'

const execFileAsync = promisify(execFile)

type PackedPackage = {
  name: string
  version: string
  tarballFilename: string
  tarballBytes: Buffer
  integrity: string
  signature: string
}

type MockRegistryPackage = {
  packageInfo: PackedPackage
  tarballUrl: string
}

function logStep(message: string) {
  console.log(`[e2e] ${message}`)
}

async function getFreePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  server.close()
  await once(server, 'close')

  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine a free port')
  }

  return address.port
}

async function startServer(server: net.Server, port: number) {
  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
}

async function stopServer(server: net.Server) {
  if ('closeIdleConnections' in server && typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections()
  }
  if ('closeAllConnections' in server && typeof server.closeAllConnections === 'function') {
    server.closeAllConnections()
  }
  server.close()
  await once(server, 'close')
}

function tarballPathname(packageName: string, tarballFilename: string) {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.split('/')
    return `/${scope}/${name}/-/${tarballFilename}`
  }

  return `/${packageName}/-/${tarballFilename}`
}

function packumentPathname(packageName: string) {
  if (packageName.startsWith('@')) {
    return `/${packageName.replace('/', '%2f')}`
  }

  return `/${packageName}`
}

function createPackument(mockPackage: MockRegistryPackage) {
  return {
    name: mockPackage.packageInfo.name,
    'dist-tags': {
      latest: mockPackage.packageInfo.version,
    },
    versions: {
      [mockPackage.packageInfo.version]: {
        name: mockPackage.packageInfo.name,
        version: mockPackage.packageInfo.version,
        dist: {
          integrity: mockPackage.packageInfo.integrity,
          signatures: [
            {
              keyid: mockPackage.packageInfo.signature ? undefined : undefined,
            },
          ],
          tarball: mockPackage.tarballUrl,
        },
      },
    },
  }
}

function createSignedPackument(mockPackage: MockRegistryPackage, signingKeyId: string) {
  const packument = createPackument(mockPackage)
  const versionMetadata = (packument.versions as Record<string, Record<string, unknown>>)[mockPackage.packageInfo.version]!
  const dist = versionMetadata.dist as Record<string, unknown>
  dist.signatures = [
    {
      keyid: signingKeyId,
      sig: mockPackage.packageInfo.signature,
    },
  ]
  return packument
}

function createMockRegistryServer(input: {
  baseUrl: string
  keys: NpmKey[]
  packages: MockRegistryPackage[]
}) {
  const packuments = new Map<string, Record<string, unknown>>()
  const tarballs = new Map<string, Buffer>()

  for (const mockPackage of input.packages) {
    packuments.set(
      packumentPathname(mockPackage.packageInfo.name),
      createSignedPackument(mockPackage, input.keys[0]!.keyid),
    )
    tarballs.set(
      tarballPathname(mockPackage.packageInfo.name, mockPackage.packageInfo.tarballFilename),
      mockPackage.packageInfo.tarballBytes,
    )
  }

  return http.createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', input.baseUrl).pathname
    if (pathname === '/-/npm/v1/keys') {
      response.statusCode = 200
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(`${JSON.stringify({ keys: input.keys })}\n`)
      return
    }

    const tarball = tarballs.get(pathname)
    if (tarball) {
      response.statusCode = 200
      response.setHeader('content-type', 'application/octet-stream')
      response.setHeader('content-length', String(tarball.byteLength))
      response.end(tarball)
      return
    }

    const packument = packuments.get(pathname)
    if (packument) {
      response.statusCode = 200
      response.setHeader('content-type', 'application/json; charset=utf-8')
      response.end(`${JSON.stringify(packument)}\n`)
      return
    }

    response.statusCode = 404
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.end(`${JSON.stringify({ error: 'not found' })}\n`)
  })
}

async function createPackedPackage(input: {
  tempRoot: string
  name: string
  version: string
  privateKeyPem: string
}) {
  const packageDir = path.join(
    input.tempRoot,
    `pkg-${input.name.replaceAll('@', '').replaceAll('/', '-')}@${input.version}`,
  )
  await mkdir(packageDir, { recursive: true })
  await writeFile(
    path.join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: input.name,
        version: input.version,
        main: 'index.js',
      },
      null,
      2,
    ),
  )
  await writeFile(path.join(packageDir, 'index.js'), `module.exports = ${JSON.stringify(input.name)}\n`)

  const { stdout } = await execFileAsync('npm', ['pack', '--json'], {
    cwd: packageDir,
  })
  const [{ filename }] = JSON.parse(stdout) as Array<{ filename: string }>
  const tarballBytes = await readFile(path.join(packageDir, filename))
  const integrity = createArtifactDigest(tarballBytes)
  const signature = signText(
    input.privateKeyPem,
    createPackageSignatureText(input.name, input.version, integrity),
  )

  return {
    name: input.name,
    version: input.version,
    tarballFilename: filename,
    tarballBytes,
    integrity,
    signature,
  } satisfies PackedPackage
}

async function npmInstall(input: {
  directory: string
  registryBaseUrl: string
  packageName: string
}) {
  await execFileAsync('npm', ['init', '-y'], {
    cwd: input.directory,
  })

  await execFileAsync(
    'npm',
    [
      'install',
      `--registry=${input.registryBaseUrl}`,
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      input.packageName,
    ],
    {
      cwd: input.directory,
      env: {
        ...process.env,
        npm_config_cache: path.join(input.directory, '.npm-cache'),
      },
    },
  )
}

async function fetchResolvedTarballPath(projectDir: string, packagePath: string) {
  const lock = JSON.parse(await readFile(path.join(projectDir, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { resolved: string; version: string }>
  }
  const entry = lock.packages[packagePath]
  if (!entry) {
    throw new Error(`Missing package lock entry for ${packagePath}`)
  }

  const targetPath = path.join(projectDir, `${packagePath.replaceAll('/', '__')}-${entry.version}.tgz`)
  await execFileAsync('curl', ['-sSLo', targetPath, entry.resolved])
  return {
    resolved: entry.resolved,
    version: entry.version,
    tarballPath: targetPath,
  }
}

async function fetchLookup(sumDbBaseUrl: string, keyId: string, packageName: string, version: string) {
  const response = await fetch(
    `${sumDbBaseUrl}/lookup/${encodeURIComponent(keyId)}/${packageName
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')}/${encodeURIComponent(version)}`,
  )
  return (await response.json()) as {
    records: Array<{
      type: string
      digest: string
      integrity: string
      signature: string
      keyId: string
      leafIndex: number
    }>
  }
}

async function fetchPackumentFromRegistry(registryBaseUrl: string, packageName: string) {
  const response = await fetch(`${registryBaseUrl}${packumentPathname(packageName)}`)
  if (!response.ok) {
    throw new Error(`Unable to fetch packument for ${packageName} from ${registryBaseUrl}`)
  }
  return (await response.json()) as Record<string, unknown>
}

test(
  'proxy + sumdb E2E flow distinguishes mirrors from registries and serves aggregated keys',
  { timeout: 120_000 },
  async () => {
    logStep('allocating temp workspace and local ports')
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'npmx-registry-e2e-'))
    const npmOriginPort = await getFreePort()
    const mirrorPort = await getFreePort()
    const registryPort = await getFreePort()
    const sumDbPort = await getFreePort()
    const mirrorProxyPort = await getFreePort()
    const originProxyPort = await getFreePort()

    const npmOriginBaseUrl = `http://127.0.0.1:${npmOriginPort}`
    const mirrorBaseUrl = `http://127.0.0.1:${mirrorPort}`
    const registryBaseUrl = `http://127.0.0.1:${registryPort}`
    const sumDbBaseUrl = `http://127.0.0.1:${sumDbPort}`
    const mirrorProxyBaseUrl = `http://127.0.0.1:${mirrorProxyPort}`
    const originProxyBaseUrl = `http://127.0.0.1:${originProxyPort}`

    const npmSigningKeys = generateRegistryKeyPair()
    const registrySigningKeys = generateRegistryKeyPair()
    const sumDbKeys = generateRegistryKeyPair()
    const mirrorProxyKeys = generateRegistryKeyPair()
    const originProxyKeys = generateRegistryKeyPair()

    logStep('creating package fixtures for npm-origin, mirror, and registry-only packages')
    const sharedPackage = await createPackedPackage({
      tempRoot,
      name: 'shared-demo-package',
      version: '1.0.0',
      privateKeyPem: npmSigningKeys.privateKeyPem,
    })
    const npmOnlyPackage = await createPackedPackage({
      tempRoot,
      name: 'npm-only-demo-package',
      version: '1.0.0',
      privateKeyPem: npmSigningKeys.privateKeyPem,
    })
    const registryOnlyPackage = await createPackedPackage({
      tempRoot,
      name: 'registry-only-demo-package',
      version: '1.0.0',
      privateKeyPem: registrySigningKeys.privateKeyPem,
    })

    const npmOriginServer = createMockRegistryServer({
      baseUrl: npmOriginBaseUrl,
      keys: [npmSigningKeys.npmKey],
      packages: [
        {
          packageInfo: sharedPackage,
          tarballUrl: `${npmOriginBaseUrl}${tarballPathname(sharedPackage.name, sharedPackage.tarballFilename)}`,
        },
        {
          packageInfo: npmOnlyPackage,
          tarballUrl: `${npmOriginBaseUrl}${tarballPathname(npmOnlyPackage.name, npmOnlyPackage.tarballFilename)}`,
        },
      ],
    })

    const mirrorServer = createMockRegistryServer({
      baseUrl: mirrorBaseUrl,
      keys: [npmSigningKeys.npmKey],
      packages: [
        {
          packageInfo: sharedPackage,
          tarballUrl: `${mirrorBaseUrl}${tarballPathname(sharedPackage.name, sharedPackage.tarballFilename)}`,
        },
        {
          packageInfo: npmOnlyPackage,
          tarballUrl: `${npmOriginBaseUrl}${tarballPathname(npmOnlyPackage.name, npmOnlyPackage.tarballFilename)}`,
        },
      ],
    })

    const registryServer = createMockRegistryServer({
      baseUrl: registryBaseUrl,
      keys: [registrySigningKeys.npmKey],
      packages: [
        {
          packageInfo: registryOnlyPackage,
          tarballUrl: `${registryBaseUrl}${tarballPathname(
            registryOnlyPackage.name,
            registryOnlyPackage.tarballFilename,
          )}`,
        },
      ],
    })

    const sourceRegistries: ConfiguredSourceRegistry[] = [
      { label: 'mirror', registryBaseUrl: mirrorBaseUrl, kind: 'mirror' },
      { label: 'npm-origin', registryBaseUrl: npmOriginBaseUrl, kind: 'mirror' },
      { label: 'registry-only', registryBaseUrl: registryBaseUrl, kind: 'registry' },
    ]

    await startServer(npmOriginServer, npmOriginPort)
    await startServer(mirrorServer, mirrorPort)
    await startServer(registryServer, registryPort)

    logStep('hydrating source registries and collecting trusted signing keys')
    const hydratedRegistries = await hydrateSourceRegistries(sourceRegistries)
    assert.equal(hydratedRegistries[0]!.npmKeys[0]!.keyid, npmSigningKeys.npmKey.keyid)
    assert.equal(hydratedRegistries[1]!.npmKeys[0]!.keyid, npmSigningKeys.npmKey.keyid)
    assert.equal(hydratedRegistries[2]!.npmKeys[0]!.keyid, registrySigningKeys.npmKey.keyid)

    const trustedResponsibleKeys = collectPublishedKeys(hydratedRegistries)
    const sumDb = await createSumDbServer({
      port: sumDbPort,
      dataDir: path.join(tempRoot, 'sumdb'),
      sumDbPrivateKey: sumDbKeys.privateKeyPem,
      sumDbPublicKey: sumDbKeys.publicKeyPem,
      allowedRegistryKeys: null,
      trustedResponsibleKeys,
    })
    await startServer(sumDb.server, sumDbPort)

    logStep('starting a proxy that prefers the mirror candidate when multiple sources can serve a package')
    const mirrorProxy = await createRegistryProxyServer({
      port: mirrorProxyPort,
      baseUrl: mirrorProxyBaseUrl,
      sourceRegistries,
      cacheDir: path.join(tempRoot, 'proxy-cache-mirror'),
      sumDbBaseUrl,
      registryPrivateKey: mirrorProxyKeys.privateKeyPem,
      registryPublicKey: mirrorProxyKeys.publicKeyPem,
      random: () => 0,
    })
    await startServer(mirrorProxy.server, mirrorProxyPort)

    logStep('starting a second proxy that prefers the npm-origin candidate')
    const originProxy = await createRegistryProxyServer({
      port: originProxyPort,
      baseUrl: originProxyBaseUrl,
      sourceRegistries,
      cacheDir: path.join(tempRoot, 'proxy-cache-origin'),
      sumDbBaseUrl,
      registryPrivateKey: originProxyKeys.privateKeyPem,
      registryPublicKey: originProxyKeys.publicKeyPem,
      random: () => 0.99,
    })
    await startServer(originProxy.server, originProxyPort)

    try {
      logStep('checking proxy /-/npm/v1/keys aggregates upstream keys with the proxy key')
      const keysResponse = await fetch(`${mirrorProxyBaseUrl}/-/npm/v1/keys`)
      const keysPayload = (await keysResponse.json()) as { keys: NpmKey[] }
      const servedKeyIds = new Set(keysPayload.keys.map(key => key.keyid))
      assert.equal(servedKeyIds.has(mirrorProxyKeys.keyId), true)
      assert.equal(servedKeyIds.has(npmSigningKeys.keyId), true)
      assert.equal(servedKeyIds.has(registrySigningKeys.keyId), true)
      assert.equal(keysPayload.keys.length, 3)

      logStep('verifying random routing can choose mirror or npm-origin for the same package')
      const mirrorSharedPackument = await fetchPackumentFromRegistry(mirrorProxyBaseUrl, sharedPackage.name)
      const originSharedPackument = await fetchPackumentFromRegistry(originProxyBaseUrl, sharedPackage.name)
      const mirrorSharedDist = ((mirrorSharedPackument.versions as Record<string, unknown>)[sharedPackage.version] as Record<
        string,
        unknown
      >).dist as Record<string, unknown>
      const originSharedDist = ((originSharedPackument.versions as Record<string, unknown>)[sharedPackage.version] as Record<
        string,
        unknown
      >).dist as Record<string, unknown>
      assert.equal(
        mirrorSharedDist.tarball,
        `${mirrorBaseUrl}${tarballPathname(sharedPackage.name, sharedPackage.tarballFilename)}`,
      )
      assert.equal(
        originSharedDist.tarball,
        `${npmOriginBaseUrl}${tarballPathname(sharedPackage.name, sharedPackage.tarballFilename)}`,
      )

      logStep('installing a package that exists in npm-origin and mirror but not in the custom registry')
      const npmOnlyProject = path.join(tempRoot, 'npm-only-project')
      await mkdir(npmOnlyProject, { recursive: true })
      await npmInstall({
        directory: npmOnlyProject,
        registryBaseUrl: mirrorProxyBaseUrl,
        packageName: npmOnlyPackage.name,
      })
      const npmOnlyTarball = await fetchResolvedTarballPath(npmOnlyProject, `node_modules/${npmOnlyPackage.name}`)
      assert.equal(
        npmOnlyTarball.resolved,
        `${npmOriginBaseUrl}${tarballPathname(npmOnlyPackage.name, npmOnlyPackage.tarballFilename)}`,
      )

      logStep('installing a package that exists only in the custom registry with its own key')
      const registryOnlyProject = path.join(tempRoot, 'registry-only-project')
      await mkdir(registryOnlyProject, { recursive: true })
      await npmInstall({
        directory: registryOnlyProject,
        registryBaseUrl: mirrorProxyBaseUrl,
        packageName: registryOnlyPackage.name,
      })
      const registryOnlyTarball = await fetchResolvedTarballPath(
        registryOnlyProject,
        `node_modules/${registryOnlyPackage.name}`,
      )
      assert.equal(
        registryOnlyTarball.resolved,
        `${registryBaseUrl}${tarballPathname(registryOnlyPackage.name, registryOnlyPackage.tarballFilename)}`,
      )

      logStep('verifying the npm-origin-backed package was checkpointed under the shared npm signing key')
      const npmOnlyVerification = await verifyPackageFromSumDb({
        sumDbBaseUrl,
        registryKeyId: npmSigningKeys.keyId,
        packageName: npmOnlyPackage.name,
        version: npmOnlyPackage.version,
        tarballPath: npmOnlyTarball.tarballPath,
      })
      assert.equal(npmOnlyVerification.ok, true)

      logStep('verifying the registry-only package was checkpointed under the registry-specific key')
      const registryOnlyVerification = await verifyPackageFromSumDb({
        sumDbBaseUrl,
        registryKeyId: registrySigningKeys.keyId,
        packageName: registryOnlyPackage.name,
        version: registryOnlyPackage.version,
        tarballPath: registryOnlyTarball.tarballPath,
      })
      assert.equal(registryOnlyVerification.ok, true)

      logStep('checking the logged leaves keep only the minimal tarball record shape')
      const npmOnlyLookup = await fetchLookup(
        sumDbBaseUrl,
        npmSigningKeys.keyId,
        npmOnlyPackage.name,
        npmOnlyPackage.version,
      )
      const npmOnlyRecord = npmOnlyLookup.records[0]
      assert.ok(npmOnlyRecord)
      assert.equal(npmOnlyRecord.keyId, npmSigningKeys.keyId)
      assert.equal(npmOnlyRecord.integrity, npmOnlyPackage.integrity)
      assert.ok(typeof npmOnlyRecord.signature === 'string' && npmOnlyRecord.signature.length > 0)

      const registryOnlyLookup = await fetchLookup(
        sumDbBaseUrl,
        registrySigningKeys.keyId,
        registryOnlyPackage.name,
        registryOnlyPackage.version,
      )
      const registryOnlyRecord = registryOnlyLookup.records[0]
      assert.ok(registryOnlyRecord)
      assert.equal(registryOnlyRecord.keyId, registrySigningKeys.keyId)
      assert.equal(registryOnlyRecord.integrity, registryOnlyPackage.integrity)

      logStep('verifying local registry key discovery matches the mirror-vs-registry distinction')
      const mirrorKeys = await fetchRegistryKeys(mirrorBaseUrl)
      const npmOriginKeys = await fetchRegistryKeys(npmOriginBaseUrl)
      const registryKeys = await fetchRegistryKeys(registryBaseUrl)
      assert.equal(mirrorKeys[0]!.keyid, npmOriginKeys[0]!.keyid)
      assert.notEqual(registryKeys[0]!.keyid, npmOriginKeys[0]!.keyid)
    } finally {
      logStep('shutting down proxies, sumdb, and local registries')
      await stopServer(mirrorProxy.server)
      await stopServer(originProxy.server)
      await stopServer(sumDb.server)
      await stopServer(npmOriginServer)
      await stopServer(mirrorServer)
      await stopServer(registryServer)
      await rm(tempRoot, { recursive: true, force: true })
    }
  },
)

test('source registry selection randomizes among available candidates', () => {
  const npmKey = generateRegistryKeyPair().npmKey
  const registries = [
    {
      label: 'mirror',
      registryBaseUrl: 'https://mirror.example',
      kind: 'mirror' as const,
      keysEndpoint: 'https://mirror.example/-/npm/v1/keys',
      npmKeys: [npmKey],
    },
    {
      label: 'npm-origin',
      registryBaseUrl: 'https://registry.npmjs.example',
      kind: 'mirror' as const,
      keysEndpoint: 'https://registry.npmjs.example/-/npm/v1/keys',
      npmKeys: [npmKey],
    },
  ]

  assert.equal(resolveSourceRegistry(registries, () => 0).label, 'mirror')
  assert.equal(resolveSourceRegistry(registries, () => 0.99).label, 'npm-origin')
})
