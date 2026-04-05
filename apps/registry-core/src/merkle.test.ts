import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getConsistencyProof,
  getInclusionProof,
  merkleRoot,
  verifyConsistencyProof,
  verifyInclusionProof,
} from './merkle.ts'
import {
  createArtifactDigest,
  createCheckpointText,
  createLeafRecord,
  deriveKeyId,
  generateRegistryKeyPair,
  signCheckpoint,
  verifyCheckpoint,
} from './index.ts'

function makeLeaf(index: number, keyId: string) {
  return createLeafRecord({
    keyId,
    name: index % 2 === 0 ? 'is-number' : '@scope/demo',
    version: index % 2 === 0 ? '1.0.0' : '2.0.0',
    type: 'tarball',
    digest: createArtifactDigest(Buffer.from(`leaf-${index}`)),
    size: index + 1,
    url: `https://registry.example.test/artifact/${index}`,
    integrity: createArtifactDigest(Buffer.from(`integrity-${index}`)),
  }).canonicalLeaf
}

test('inclusion proofs verify against the calculated root', () => {
  const { keyId } = generateRegistryKeyPair()
  const leaves = Array.from({ length: 8 }, (_, index) => makeLeaf(index, keyId))
  const root = merkleRoot(leaves)

  for (const [index, leaf] of leaves.entries()) {
    const proof = getInclusionProof(leaves, index)
    assert.equal(
      verifyInclusionProof({
        leaf,
        leafIndex: index,
        treeSize: leaves.length,
        proof,
        expectedRoot: root,
      }),
      true,
    )
  }
})

test('consistency proofs verify tree growth', () => {
  const { keyId } = generateRegistryKeyPair()
  const leaves = Array.from({ length: 9 }, (_, index) => makeLeaf(index, keyId))

  for (let fromSize = 1; fromSize < leaves.length; fromSize++) {
    const proof = getConsistencyProof(leaves, fromSize, leaves.length)
    assert.equal(
      verifyConsistencyProof({
        fromTreeSize: fromSize,
        toTreeSize: leaves.length,
        oldRoot: merkleRoot(leaves.slice(0, fromSize)),
        newRoot: merkleRoot(leaves),
        proof,
      }),
      true,
      `expected proof for ${fromSize} -> ${leaves.length} to verify`,
    )
  }
})

test('checkpoint signing and key ids are deterministic', () => {
  const { privateKeyPem, publicKeyPem, keyId } = generateRegistryKeyPair()
  const checkpoint = signCheckpoint(
    {
      treeSize: 3,
      rootHash: merkleRoot([makeLeaf(1, keyId)]),
      issuedAt: '2026-01-01T00:00:00.000Z',
      keyId,
    },
    privateKeyPem,
    publicKeyPem,
  )

  assert.equal(verifyCheckpoint(checkpoint), true)
  assert.equal(checkpoint.keyId, deriveKeyId(publicKeyPem))
  assert.match(createCheckpointText(checkpoint), /^npmx-sumdb-checkpoint-v1/m)
})
