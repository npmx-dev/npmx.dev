import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import {
  createLeafRecord,
  createPackageSignatureText,
  getConsistencyProof,
  getInclusionProof,
  hashNode,
  merkleRoot,
  npmKeyToPublicKeyPem,
  signCheckpoint,
  type CheckpointPayload,
  type ConsistencyProofResponse,
  type InclusionProofResponse,
  type IngestRecord,
  type NpmKey,
  type SignedCheckpoint,
  type SumDbLeafRecord,
} from '../../registry-core/src/index.ts'

interface SumDbState {
  leaves: SumDbLeafRecord[]
  checkpoints: SignedCheckpoint[]
}

function createInitialState(): SumDbState {
  return {
    leaves: [],
    checkpoints: [],
  }
}

export class SumDbStore {
  readonly dataDir: string
  readonly statePath: string
  readonly sumDbPrivateKey: string
  readonly sumDbPublicKey: string
  readonly sumDbKeyId: string
  readonly allowedRegistryKeys: Set<string> | null
  readonly trustedResponsibleKeys: Map<string, NpmKey>

  state: SumDbState = createInitialState()

  constructor(input: {
    dataDir: string
    sumDbPrivateKey: string
    sumDbPublicKey: string
    sumDbKeyId: string
    allowedRegistryKeys: string[] | null
    trustedResponsibleKeys: NpmKey[]
  }) {
    this.dataDir = input.dataDir
    this.statePath = path.join(this.dataDir, 'state.json')
    this.sumDbPrivateKey = input.sumDbPrivateKey
    this.sumDbPublicKey = input.sumDbPublicKey
    this.sumDbKeyId = input.sumDbKeyId
    this.allowedRegistryKeys =
      input.allowedRegistryKeys && input.allowedRegistryKeys.length > 0
        ? new Set(input.allowedRegistryKeys)
        : null
    this.trustedResponsibleKeys = new Map(input.trustedResponsibleKeys.map(key => [key.keyid, key]))
  }

  async load() {
    await fs.mkdir(this.dataDir, { recursive: true })

    try {
      const raw = await fs.readFile(this.statePath, 'utf8')
      this.state = JSON.parse(raw) as SumDbState
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'ENOENT') {
        throw error
      }
      this.state = createInitialState()
      await this.save()
    }
  }

  async save() {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2))
  }

  latestCheckpoint(): SignedCheckpoint {
    const latest = this.state.checkpoints[this.state.checkpoints.length - 1]
    if (latest) {
      return latest
    }

    const payload: CheckpointPayload = {
      treeSize: 0,
      rootHash: merkleRoot([]),
      issuedAt: new Date().toISOString(),
      keyId: this.sumDbKeyId,
    }

    const checkpoint = signCheckpoint(payload, this.sumDbPrivateKey, this.sumDbPublicKey)
    this.state.checkpoints.push(checkpoint)
    return checkpoint
  }

  private assertRegistryAllowed(keyId: string) {
    if (this.allowedRegistryKeys && !this.allowedRegistryKeys.has(keyId)) {
      throw new Error(`Registry key ${keyId} is not allowed to ingest records`)
    }
  }

  private verifyRecord(record: IngestRecord) {
    if (record.type !== 'tarball') {
      throw new Error(`Only tarball records can be ingested`)
    }
    if (!record.integrity) {
      throw new Error(`Integrity is required for all ingested records`)
    }
    this.assertRegistryAllowed(record.keyId)

    const responsibleKey = this.trustedResponsibleKeys.get(record.keyId)
    if (!responsibleKey) {
      throw new Error(`Unknown responsible key ${record.keyId}`)
    }

    // The sumdb re-verifies the upstream package signature using only the trusted public key
    // for the responsible key ID and the signature stored alongside the logged artifact record.
    const upstreamVerified = crypto.verify(
      'sha256',
      Buffer.from(createPackageSignatureText(record.name, record.version, record.integrity)),
      npmKeyToPublicKeyPem(responsibleKey),
      Buffer.from(record.signature, 'base64'),
    )
    if (!upstreamVerified) {
      throw new Error(`Upstream signature verification failed for ${record.name}@${record.version}`)
    }
  }

  async ingest(record: IngestRecord) {
    this.verifyRecord(record)

    const leaf = createLeafRecord(record)
    const existingIndex = this.state.leaves.findIndex(existing => existing.canonicalLeaf === leaf.canonicalLeaf)
    if (existingIndex !== -1) {
      return {
        leaf: this.state.leaves[existingIndex]!,
        checkpoint: this.latestCheckpoint(),
        leafIndex: existingIndex,
        deduped: true,
      }
    }

    this.state.leaves.push(leaf)

    const payload: CheckpointPayload = {
      treeSize: this.state.leaves.length,
      rootHash: merkleRoot(this.state.leaves.map(item => item.canonicalLeaf)),
      issuedAt: new Date().toISOString(),
      keyId: this.sumDbKeyId,
    }

    const checkpoint = signCheckpoint(payload, this.sumDbPrivateKey, this.sumDbPublicKey)
    this.state.checkpoints.push(checkpoint)
    await this.save()

    return {
      leaf,
      checkpoint,
      leafIndex: this.state.leaves.length - 1,
      deduped: false,
    }
  }

  lookup(keyId: string, packageName: string, version: string) {
    const records = this.state.leaves
      .map((record, leafIndex) => ({ ...record, leafIndex }))
      .filter(record => record.keyId === keyId && record.name === packageName && record.version === version)

    return {
      keyId,
      name: packageName,
      version,
      records,
      treeSize: this.latestCheckpoint().treeSize,
      checkpointId: this.state.checkpoints.length - 1,
    }
  }

  getCheckpointByTreeSize(treeSize: number) {
    return this.state.checkpoints.find(checkpoint => checkpoint.treeSize === treeSize) ?? null
  }

  getTile(level: number, index: number) {
    if (level < 0 || index < 0) {
      return null
    }

    let hashes = this.state.leaves.map(record => record.leafHash)
    if (level === 0) {
      return hashes[index] ?? null
    }

    for (let currentLevel = 1; currentLevel <= level; currentLevel++) {
      const nextLevel: string[] = []
      for (let offset = 0; offset < hashes.length; offset += 2) {
        const left = hashes[offset]
        const right = hashes[offset + 1]
        if (!left) continue
        nextLevel.push(right ? hashNode(left, right) : left)
      }
      hashes = nextLevel
    }

    return hashes[index] ?? null
  }

  getInclusionProof(leafIndex: number, treeSize: number): InclusionProofResponse {
    if (treeSize < 1 || treeSize > this.state.leaves.length) {
      throw new Error(`Tree size ${treeSize} is outside the current tree`)
    }

    const leaf = this.state.leaves[leafIndex]
    if (!leaf || leafIndex >= treeSize) {
      throw new Error(`Leaf index ${leafIndex} is outside tree size ${treeSize}`)
    }

    return {
      leafHash: leaf.leafHash,
      leafIndex,
      treeSize,
      hashes: getInclusionProof(
        this.state.leaves.slice(0, treeSize).map(item => item.canonicalLeaf),
        leafIndex,
        treeSize,
      ),
    }
  }

  getConsistencyProof(fromTreeSize: number, toTreeSize: number): ConsistencyProofResponse {
    if (toTreeSize < 1 || toTreeSize > this.state.leaves.length) {
      throw new Error(`Tree size ${toTreeSize} is outside the current tree`)
    }

    return {
      fromTreeSize,
      toTreeSize,
      hashes: getConsistencyProof(
        this.state.leaves.slice(0, toTreeSize).map(item => item.canonicalLeaf),
        fromTreeSize,
        toTreeSize,
      ),
    }
  }
}
