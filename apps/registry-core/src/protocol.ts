import type { NpmKey } from './crypto.ts'
import { deriveKeyId, sha256Hex, sha512Base64, signText, verifyText } from './crypto.ts'

export type ArtifactType = 'tarball'

export interface RegistryIdentity {
  keyId: string
  publicKey: string
  baseUrl: string
  upstreamBaseUrl: string
}

export interface SourceRegistry {
  label: string
  registryBaseUrl: string
  keysEndpoint: string
  npmKeys: NpmKey[]
}

export interface IngestRecord {
  keyId: string
  name: string
  version: string
  type: ArtifactType
  digest: string
  size: number
  url: string
  integrity: string
  signature: string
}

export interface SumDbLeafRecord extends IngestRecord {
  canonicalLeaf: string
  leafHash: string
}

export interface CheckpointPayload {
  treeSize: number
  rootHash: string
  issuedAt: string
  keyId: string
}

export interface SignedCheckpoint extends CheckpointPayload {
  signature: string
  publicKey: string
}

export interface InclusionProofResponse {
  leafHash: string
  leafIndex: number
  treeSize: number
  hashes: string[]
}

export interface ConsistencyProofResponse {
  fromTreeSize: number
  toTreeSize: number
  hashes: string[]
}

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null'
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )

  // The sumdb and proxy use this when hashing or persisting records so object key order
  // never changes the signed/checkpointed bytes.
  return `{${entries
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}

export function createRegistryIdentity(input: {
  publicKey: string
  baseUrl: string
  upstreamBaseUrl: string
}): RegistryIdentity {
  return {
    keyId: deriveKeyId(input.publicKey),
    publicKey: input.publicKey,
    baseUrl: input.baseUrl,
    upstreamBaseUrl: input.upstreamBaseUrl,
  }
}

export function resolveSourceRegistry(registries: SourceRegistry[]): SourceRegistry {
  const matched = registries[0]
  if (!matched) {
    throw new Error('No source registry configured')
  }

  // With package-level routing removed, the first configured registry is the fetch source.
  return matched
}

export function createArtifactDigest(input: Buffer | string): string {
  return `sha512-${sha512Base64(input)}`
}

export function createCanonicalLeaf(record: IngestRecord): string {
  // The logged leaf is intentionally minimal and immutable: only the responsible signing key
  // plus the artifact facts needed for independent digest verification are checkpointed.
  return [
    'v1',
    record.keyId,
    record.name,
    record.version,
    record.type,
    record.digest,
    String(record.size),
    record.url,
    record.integrity,
    record.signature,
  ].join(' ')
}

export function createLeafHash(canonicalLeaf: string): string {
  return sha256Hex(Buffer.from(canonicalLeaf))
}

export function createLeafRecord(record: IngestRecord): SumDbLeafRecord {
  const canonicalLeaf = createCanonicalLeaf(record)
  return {
    ...record,
    canonicalLeaf,
    leafHash: createLeafHash(canonicalLeaf),
  }
}

export function createPackageSignatureText(name: string, version: string, integrity: string): string {
  // npm signs `${name}@${version}:${dist.integrity}` for each published version.
  return `${name}@${version}:${integrity}`
}

export function createCheckpointText(payload: CheckpointPayload): string {
  // The checkpoint text is deliberately line-oriented so it is easy to inspect and sign.
  return [
    'npmx-sumdb-checkpoint-v1',
    payload.treeSize,
    payload.rootHash,
    payload.issuedAt,
    payload.keyId,
  ].join('\n')
}

export function signCheckpoint(payload: CheckpointPayload, privateKeyPem: string, publicKey: string) {
  return {
    ...payload,
    signature: signText(privateKeyPem, createCheckpointText(payload)),
    publicKey,
  } satisfies SignedCheckpoint
}

export function verifyCheckpoint(checkpoint: SignedCheckpoint): boolean {
  return verifyText(checkpoint.publicKey, createCheckpointText(checkpoint), checkpoint.signature)
}

export function createRegistryMetadata(publicKey: string) {
  return {
    keyId: deriveKeyId(publicKey),
    publicKey,
  }
}

export function assertRegistryKeyMatchesPublicKey(registryKeyId: string, publicKey: string) {
  const derivedKeyId = deriveKeyId(publicKey)
  if (registryKeyId !== derivedKeyId) {
    throw new Error(`Registry key mismatch: expected ${derivedKeyId} but received ${registryKeyId}`)
  }
}
