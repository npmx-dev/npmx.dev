import crypto, { type BinaryLike, createPrivateKey, createPublicKey, KeyObject } from 'node:crypto'

function normalizeKeyObject(key: string | KeyObject): KeyObject {
  return typeof key === 'string' ? createPublicKey(key) : key
}

export function toBase64Url(input: BinaryLike): string {
  return Buffer.from(input).toString('base64url')
}

export function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

export function sha256(input: BinaryLike): Buffer {
  return crypto.createHash('sha256').update(input).digest()
}

export function sha512(input: BinaryLike): Buffer {
  return crypto.createHash('sha512').update(input).digest()
}

export function sha512Base64(input: BinaryLike): string {
  return sha512(input).toString('base64')
}

export function sha256Hex(input: BinaryLike): string {
  return sha256(input).toString('hex')
}

export type NpmKey = {
  expires: string | null
  keyid: string
  keytype: 'ecdsa-sha2-nistp256'
  scheme: 'ecdsa-sha2-nistp256'
  key: string
}

export function deriveKeyId(publicKey: string | KeyObject): string {
  const key = normalizeKeyObject(publicKey)
  const der = key.export({ format: 'der', type: 'spki' })
  // npm uses a SHA256 fingerprint over the SPKI public key bytes as the stable key identity.
  return `SHA256:${sha256(der).toString('base64')}`
}

export function signText(privateKeyPem: string, text: string): string {
  const privateKey = createPrivateKey(privateKeyPem)
  return crypto.sign('sha256', Buffer.from(text), privateKey).toString('base64')
}

export function verifyText(publicKeyPem: string, text: string, signature: string): boolean {
  const publicKey = createPublicKey(publicKeyPem)
  return crypto.verify('sha256', Buffer.from(text), publicKey, Buffer.from(signature, 'base64'))
}

export function exportPublicKeyBase64(publicKey: string | KeyObject): string {
  const key = normalizeKeyObject(publicKey)
  return key.export({ format: 'der', type: 'spki' }).toString('base64')
}

export function npmKeyToPublicKeyPem(key: NpmKey): string {
  return createPublicKey({
    key: Buffer.from(key.key, 'base64'),
    format: 'der',
    type: 'spki',
  })
    .export({ format: 'pem', type: 'spki' })
    .toString()
}

export function publicKeyPemToNpmKey(publicKeyPem: string, expires: string | null = null): NpmKey {
  // We publish our own keys in the same shape npm serves from /-/npm/v1/keys so
  // signature verification logic can treat upstream and local registries uniformly.
  return {
    expires,
    keyid: deriveKeyId(publicKeyPem),
    keytype: 'ecdsa-sha2-nistp256',
    scheme: 'ecdsa-sha2-nistp256',
    key: exportPublicKeyBase64(publicKeyPem),
  }
}

export function generateRegistryKeyPair(): {
  privateKeyPem: string
  publicKeyPem: string
  keyId: string
  npmKey: NpmKey
} {
  // P-256 keeps our local registry and sumdb keys compatible with npm's published key format.
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  })
  const privateKeyPem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString()

  return {
    privateKeyPem,
    publicKeyPem,
    keyId: deriveKeyId(publicKeyPem),
    npmKey: publicKeyPemToNpmKey(publicKeyPem),
  }
}
