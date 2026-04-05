import fs from 'node:fs/promises'
import {
  createArtifactDigest,
  verifyCheckpoint,
  verifyConsistencyProof,
  verifyInclusionProof,
  type ConsistencyProofResponse,
  type InclusionProofResponse,
  type SignedCheckpoint,
  type SumDbLeafRecord,
} from '../../registry-core/src/index.ts'

export interface VerifyPackageInput {
  sumDbBaseUrl: string
  registryKeyId: string
  packageName: string
  version: string
  tarballPath?: string
}

export interface VerifyPackageResult {
  ok: true
  packageName: string
  version: string
  registryKeyId: string
  leafIndex: number
  checkpointTreeSize: number
}

export async function verifyPackageFromSumDb(input: VerifyPackageInput): Promise<VerifyPackageResult> {
  // Verification walks the same chain a third party would: lookup the recorded leaf,
  // verify the latest checkpoint signature, then verify inclusion/consistency proofs.
  const lookupResponse = await fetch(
    `${input.sumDbBaseUrl}/lookup/${encodeURIComponent(input.registryKeyId)}/${input.packageName
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')}/${encodeURIComponent(input.version)}`,
  )

  if (!lookupResponse.ok) {
    throw new Error(`Lookup failed with ${lookupResponse.status}`)
  }

  const lookup = (await lookupResponse.json()) as {
    treeSize: number
    records: Array<SumDbLeafRecord & { leafIndex: number }>
  }

  const tarballRecord = lookup.records.find(record => record.type === 'tarball')
  if (!tarballRecord) {
    throw new Error(`No tarball record found for ${input.packageName}@${input.version}`)
  }

  const checkpointResponse = await fetch(`${input.sumDbBaseUrl}/latest-checkpoint`)
  const checkpoint = (await checkpointResponse.json()) as SignedCheckpoint

  if (!verifyCheckpoint(checkpoint)) {
    throw new Error('Checkpoint signature verification failed')
  }

  const inclusionResponse = await fetch(
    `${input.sumDbBaseUrl}/proof/inclusion/${tarballRecord.leafIndex}?treeSize=${lookup.treeSize}`,
  )
  const inclusion = (await inclusionResponse.json()) as InclusionProofResponse
  const inclusionVerified = verifyInclusionProof({
    leaf: tarballRecord.canonicalLeaf,
    leafIndex: tarballRecord.leafIndex,
    treeSize: inclusion.treeSize,
    proof: inclusion.hashes,
    expectedRoot: checkpoint.rootHash,
  })

  if (!inclusionVerified) {
    throw new Error('Inclusion proof verification failed')
  }

  if (lookup.treeSize > 1) {
    const consistencyResponse = await fetch(
      `${input.sumDbBaseUrl}/proof/consistency/${lookup.treeSize - 1}/${lookup.treeSize}`,
    )
    const consistency = (await consistencyResponse.json()) as ConsistencyProofResponse
    const previousCheckpointResponse = await fetch(`${input.sumDbBaseUrl}/checkpoint/${lookup.treeSize - 1}`)
    const previousCheckpoint = (await previousCheckpointResponse.json()) as SignedCheckpoint
    const consistencyVerified = verifyConsistencyProof({
      fromTreeSize: consistency.fromTreeSize,
      toTreeSize: consistency.toTreeSize,
      oldRoot: previousCheckpoint.rootHash,
      newRoot: checkpoint.rootHash,
      proof: consistency.hashes,
    })
    if (!consistencyVerified) {
      throw new Error('Consistency proof verification failed')
    }
  }

  if (input.tarballPath) {
    // When a local tarball is provided, we also confirm the checkpointed digest matches the
    // bytes that were actually downloaded during the install flow.
    const tarballBytes = await fs.readFile(input.tarballPath)
    const digest = createArtifactDigest(tarballBytes)
    if (digest !== tarballRecord.digest) {
      throw new Error(
        `Local tarball digest mismatch: expected ${tarballRecord.digest} got ${digest}`,
      )
    }
  }

  return {
    ok: true,
    packageName: input.packageName,
    version: input.version,
    registryKeyId: input.registryKeyId,
    leafIndex: tarballRecord.leafIndex,
    checkpointTreeSize: checkpoint.treeSize,
  }
}
