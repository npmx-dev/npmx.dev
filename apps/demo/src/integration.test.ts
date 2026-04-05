import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { registryCatalog } from '../../../config/registries.ts'
import {
  collectPublishedKeys,
  createPackageSignatureText,
  fetchRegistryKeys,
  generateRegistryKeyPair,
  hydrateSourceRegistries,
  npmKeyToPublicKeyPem,
  resolveSourceRegistry,
} from '../../registry-core/src/index.ts'
import { createRegistryProxyServer } from '../../registry-proxy/src/server.ts'
import { createSumDbServer } from '../../sumdb/src/server.ts'
import { verifyPackageFromSumDb } from './verify-lib.ts'
import crypto from 'node:crypto'

const execFileAsync = promisify(execFile)

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
  const encodedPackageName = packageName.startsWith('@')
    ? packageName.replace('/', '%2f')
    : packageName
  const response = await fetch(`${registryBaseUrl}/${encodedPackageName}`)
  if (!response.ok) {
    throw new Error(`Unable to fetch packument for ${packageName} from ${registryBaseUrl}`)
  }
  return (await response.json()) as Record<string, unknown>
}

function getVerifiedSigningKeyId(input: {
  packageName: string
  version: string
  packument: Record<string, unknown>
  candidateKeys: NpmKey[]
}) {
  const versions = input.packument.versions as Record<string, unknown> | undefined
  const versionMetadata = versions?.[input.version] as Record<string, unknown> | undefined
  const dist = versionMetadata?.dist as Record<string, unknown> | undefined
  const integrity = dist?.integrity
  const signatures = Array.isArray(dist?.signatures) ? (dist?.signatures as Array<Record<string, unknown>>) : []

  if (typeof integrity !== 'string' || !integrity || signatures.length === 0) {
    throw new Error(`Missing integrity or signatures for ${input.packageName}@${input.version}`)
  }

  for (const signature of signatures) {
    const keyId = typeof signature.keyid === 'string' ? signature.keyid : undefined
    const sig = typeof signature.sig === 'string' ? signature.sig : undefined
    if (!keyId || !sig) {
      continue
    }

    const matchingKey = input.candidateKeys.find(key => key.keyid === keyId)
    if (!matchingKey) {
      continue
    }

    const verified = crypto.verify(
      'sha256',
      Buffer.from(createPackageSignatureText(input.packageName, input.version, integrity)),
      npmKeyToPublicKeyPem(matchingKey),
      Buffer.from(sig, 'base64'),
    )
    if (verified) {
      return {
        keyId,
        integrity,
      }
    }
  }

  throw new Error(`No verified signing key found for ${input.packageName}@${input.version}`)
}

async function findRecordedKeyId(input: {
  sumDbBaseUrl: string
  keyIds: string[]
  packageName: string
  version: string
}) {
  for (const keyId of input.keyIds) {
    const lookup = await fetchLookup(input.sumDbBaseUrl, keyId, input.packageName, input.version)
    if (lookup.records.length > 0) {
      return {
        keyId,
        lookup,
      }
    }
  }

  throw new Error(`No sumdb record found for ${input.packageName}@${input.version}`)
}

test(
  'proxy + sumdb E2E install flow verifies minimal tarball records with logged upstream signatures',
  { timeout: 120_000 },
  async () => {
    logStep('allocating temp workspace and ports')
    const tempRoot = await mkdtemp(path.join(tmpdir(), 'npmx-registry-e2e-'))
    const sumDbPort = await getFreePort()
    const proxyPort = await getFreePort()
    const sumDbBaseUrl = `http://127.0.0.1:${sumDbPort}`
    const proxyBaseUrl = `http://127.0.0.1:${proxyPort}`
    const sumDbKeys = generateRegistryKeyPair()
    const proxyKeys = generateRegistryKeyPair()

    logStep('hydrating source registries and collecting trusted package-signing keys')
    const hydratedRegistries = await hydrateSourceRegistries(registryCatalog)
    const trustedResponsibleKeys = collectPublishedKeys(hydratedRegistries)

    const sumDb = await createSumDbServer({
      port: sumDbPort,
      dataDir: path.join(tempRoot, 'sumdb'),
      sumDbPrivateKey: sumDbKeys.privateKeyPem,
      sumDbPublicKey: sumDbKeys.publicKeyPem,
      allowedRegistryKeys: null,
      trustedResponsibleKeys,
    })

    logStep(`starting sumdb on ${sumDbBaseUrl}`)
    await startServer(sumDb.server, sumDbPort)

    logStep('creating proxy with registry catalog and runtime-fetched npm keys')
    const proxy = await createRegistryProxyServer({
      port: proxyPort,
      baseUrl: proxyBaseUrl,
      sourceRegistries: registryCatalog,
      cacheDir: path.join(tempRoot, 'proxy-cache'),
      sumDbBaseUrl,
      registryPrivateKey: proxyKeys.privateKeyPem,
      registryPublicKey: proxyKeys.publicKeyPem,
    })

    logStep(`starting proxy on ${proxyBaseUrl}`)
    await startServer(proxy.server, proxyPort)

    try {
      const firstProject = path.join(tempRoot, 'is-number-project')
      const secondProject = path.join(tempRoot, 'scoped-project')

      await mkdir(firstProject, { recursive: true })
      await mkdir(secondProject, { recursive: true })

      logStep('installing is-number through the proxy')
      await npmInstall({
        directory: firstProject,
        registryBaseUrl: proxyBaseUrl,
        packageName: 'is-number',
      })
      logStep('installing @jridgewell/resolve-uri through the proxy')
      await npmInstall({
        directory: secondProject,
        registryBaseUrl: proxyBaseUrl,
        packageName: '@jridgewell/resolve-uri',
      })

      logStep('reading resolved tarball URLs from package-lock.json')
      const firstTarball = await fetchResolvedTarballPath(firstProject, 'node_modules/is-number')
      const secondTarball = await fetchResolvedTarballPath(
        secondProject,
        'node_modules/@jridgewell/resolve-uri',
      )
      logStep(`resolved is-number tarball: ${firstTarball.resolved}`)
      logStep(`resolved @jridgewell/resolve-uri tarball: ${secondTarball.resolved}`)

      assert.ok(firstTarball.resolved.startsWith('https://registry.npmjs.org/'))
      assert.ok(secondTarball.resolved.startsWith('https://registry.npmjs.org/'))
      assert.equal(firstTarball.resolved.startsWith(proxyBaseUrl), false)
      assert.equal(secondTarball.resolved.startsWith(proxyBaseUrl), false)

      logStep('fetching source-registry keys and verifying the actual package-signing key IDs')
      const yarnKeys = await fetchRegistryKeys('https://registry.yarnpkg.com')
      const npmKeys = await fetchRegistryKeys('https://registry.npmjs.org')
      const firstPackument = await fetchPackumentFromRegistry('https://registry.yarnpkg.com', 'is-number')
      const secondPackument = await fetchPackumentFromRegistry('https://registry.npmjs.org', '@jridgewell/resolve-uri')
      const firstSigning = getVerifiedSigningKeyId({
        packageName: 'is-number',
        version: firstTarball.version,
        packument: firstPackument,
        candidateKeys: yarnKeys,
      })
      const secondSigning = getVerifiedSigningKeyId({
        packageName: '@jridgewell/resolve-uri',
        version: secondTarball.version,
        packument: secondPackument,
        candidateKeys: npmKeys,
      })
      logStep(`is-number signed by ${firstSigning.keyId}`)
      logStep(`@jridgewell/resolve-uri signed by ${secondSigning.keyId}`)

      logStep('verifying tarballs against sumdb checkpoints and proofs')
      const firstVerification = await verifyPackageFromSumDb({
        sumDbBaseUrl,
        registryKeyId: firstSigning.keyId,
        packageName: 'is-number',
        version: firstTarball.version,
        tarballPath: firstTarball.tarballPath,
      })
      const secondVerification = await verifyPackageFromSumDb({
        sumDbBaseUrl,
        registryKeyId: secondSigning.keyId,
        packageName: '@jridgewell/resolve-uri',
        version: secondTarball.version,
        tarballPath: secondTarball.tarballPath,
      })
      assert.equal(firstVerification.ok, true)
      assert.equal(secondVerification.ok, true)
      logStep(`verified is-number under ${firstSigning.keyId}`)
      logStep(`verified @jridgewell/resolve-uri under ${secondSigning.keyId}`)

      logStep('checking the sumdb stores only minimal tarball records')
      const firstLookup = await fetchLookup(sumDbBaseUrl, firstSigning.keyId, 'is-number', firstTarball.version)
      const firstRecord = firstLookup.records.find(record => record.type === 'tarball')
      assert.ok(firstRecord)
      assert.equal(firstRecord!.keyId, firstSigning.keyId)
      assert.equal(firstRecord!.integrity, firstSigning.integrity)
      assert.ok(typeof firstRecord!.digest === 'string' && firstRecord!.digest.startsWith('sha512-'))
      assert.ok(typeof firstRecord!.signature === 'string' && firstRecord!.signature.length > 0)
      assert.ok(typeof firstRecord!.leafIndex === 'number')

      const secondLookup = await fetchLookup(
        sumDbBaseUrl,
        secondSigning.keyId,
        '@jridgewell/resolve-uri',
        secondTarball.version,
      )
      const secondRecord = secondLookup.records.find(record => record.type === 'tarball')
      assert.ok(secondRecord)
      assert.equal(secondRecord!.keyId, secondSigning.keyId)
      assert.equal(secondRecord!.integrity, secondSigning.integrity)
      assert.ok(typeof secondRecord!.signature === 'string' && secondRecord!.signature.length > 0)

      logStep('verifying the proxy stays npm-compatible and does not expose custom registry routes')
      const proxyKeysResponse = await fetch(`${proxyBaseUrl}/-/npm/v1/keys`)
      const proxyKeysPayload = (await proxyKeysResponse.json()) as {
        keys: Array<{ keyid: string; keytype: string; scheme: string; key: string }>
      }
      assert.equal(proxyKeysPayload.keys.length, 1)
      assert.match(proxyKeysPayload.keys[0]!.keyid, /^SHA256:/)
      assert.equal(proxyKeysPayload.keys[0]!.keytype, 'ecdsa-sha2-nistp256')
      assert.equal(proxyKeysPayload.keys[0]!.scheme, 'ecdsa-sha2-nistp256')

      const proxyRootResponse = await fetch(`${proxyBaseUrl}/`)
      assert.equal(proxyRootResponse.status, 404)
      logStep('custom proxy introspection routes are gone; only npm-compatible paths remain')

      logStep('confirming there are no alternate key IDs recorded for the same package versions')
      const recordedFirst = await findRecordedKeyId({
        sumDbBaseUrl,
        keyIds: trustedResponsibleKeys.map(key => key.keyid),
        packageName: 'is-number',
        version: firstTarball.version,
      })
      const recordedSecond = await findRecordedKeyId({
        sumDbBaseUrl,
        keyIds: trustedResponsibleKeys.map(key => key.keyid),
        packageName: '@jridgewell/resolve-uri',
        version: secondTarball.version,
      })
      assert.equal(recordedFirst.keyId, firstSigning.keyId)
      assert.equal(recordedSecond.keyId, secondSigning.keyId)
    } finally {
      logStep('shutting down proxy and sumdb')
      await stopServer(proxy.server)
      await stopServer(sumDb.server)
      await rm(tempRoot, { recursive: true, force: true })
    }
  },
)

test('source registry resolution uses the first configured registry', () => {
  const npmKeys = generateRegistryKeyPair().npmKey
  const registries = [
    {
      label: 'first',
      registryBaseUrl: 'https://registry.first.example',
      keysEndpoint: 'https://registry.first.example/-/npm/v1/keys',
      npmKeys: [npmKeys],
    },
    {
      label: 'second',
      registryBaseUrl: 'https://registry.second.example',
      keysEndpoint: 'https://registry.second.example/-/npm/v1/keys',
      npmKeys: [npmKeys],
    },
  ]

  assert.equal(resolveSourceRegistry(registries).label, 'first')
})
