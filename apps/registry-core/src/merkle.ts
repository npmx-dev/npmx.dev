import { sha256, toBase64Url, fromBase64Url } from './crypto.ts'

function hashEmpty(): Buffer {
  return sha256(Buffer.alloc(0))
}

function hashLeafBytes(data: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([0]), data]))
}

function hashNodeBytes(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([1]), left, right]))
}

function largestPowerOfTwoLessThan(n: number): number {
  let power = 1
  while (power * 2 < n) {
    power *= 2
  }
  return power
}

function buildLeafHashes(leaves: string[]): Buffer[] {
  return leaves.map(leaf => hashLeafBytes(Buffer.from(leaf)))
}

function merkleRootFromHashedLeaves(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) {
    return hashEmpty()
  }

  if (leaves.length === 1) {
    return leaves[0]!
  }

  const split = largestPowerOfTwoLessThan(leaves.length)
  return hashNodeBytes(
    merkleRootFromHashedLeaves(leaves.slice(0, split)),
    merkleRootFromHashedLeaves(leaves.slice(split)),
  )
}

function inclusionProofBuffers(leaves: Buffer[], index: number): Buffer[] {
  if (index < 0 || index >= leaves.length) {
    throw new Error(`Leaf index ${index} is outside the tree of size ${leaves.length}`)
  }

  if (leaves.length <= 1) {
    return []
  }

  const split = largestPowerOfTwoLessThan(leaves.length)
  if (index < split) {
    return [...inclusionProofBuffers(leaves.slice(0, split), index), merkleRootFromHashedLeaves(leaves.slice(split))]
  }

  return [
    ...inclusionProofBuffers(leaves.slice(split), index - split),
    merkleRootFromHashedLeaves(leaves.slice(0, split)),
  ]
}

export function hashLeaf(leaf: string): string {
  return toBase64Url(hashLeafBytes(Buffer.from(leaf)))
}

export function hashNode(left: string, right: string): string {
  return toBase64Url(hashNodeBytes(fromBase64Url(left), fromBase64Url(right)))
}

export function merkleRoot(leaves: string[]): string {
  return toBase64Url(merkleRootFromHashedLeaves(buildLeafHashes(leaves)))
}

export function merkleRootFromLeafHashes(leafHashes: string[]): string {
  return toBase64Url(merkleRootFromHashedLeaves(leafHashes.map(hash => fromBase64Url(hash))))
}

export function getLeafHashes(leaves: string[]): string[] {
  return buildLeafHashes(leaves).map(hash => toBase64Url(hash))
}

export function getInclusionProof(leaves: string[], index: number, treeSize = leaves.length): string[] {
  return inclusionProofBuffers(buildLeafHashes(leaves.slice(0, treeSize)), index).map(hash => toBase64Url(hash))
}

export function getConsistencyProof(leaves: string[], fromTreeSize: number, toTreeSize = leaves.length): string[] {
  if (fromTreeSize < 1 || fromTreeSize > toTreeSize) {
    throw new Error(`Invalid consistency proof range ${fromTreeSize} -> ${toTreeSize}`)
  }

  if (fromTreeSize === toTreeSize) {
    return []
  }

  return getLeafHashes(leaves.slice(0, toTreeSize))
}

export function verifyInclusionProof(input: {
  leaf: string
  leafIndex: number
  treeSize: number
  proof: string[]
  expectedRoot: string
}): boolean {
  let index = input.leafIndex
  let size = input.treeSize
  let hash = hashLeafBytes(Buffer.from(input.leaf))

  for (const item of input.proof) {
    const sibling = fromBase64Url(item)
    if (index % 2 === 1 || index === size - 1) {
      hash = hashNodeBytes(sibling, hash)
    } else {
      hash = hashNodeBytes(hash, sibling)
    }

    index = Math.floor(index / 2)
    size = Math.ceil(size / 2)
  }

  return toBase64Url(hash) === input.expectedRoot
}

export function verifyConsistencyProof(input: {
  fromTreeSize: number
  toTreeSize: number
  oldRoot: string
  newRoot: string
  proof: string[]
}): boolean {
  if (input.fromTreeSize === input.toTreeSize) {
    return input.oldRoot === input.newRoot && input.proof.length === 0
  }

  if (input.fromTreeSize < 1 || input.fromTreeSize > input.toTreeSize) {
    return false
  }

  if (input.proof.length !== input.toTreeSize) {
    return false
  }

  return (
    merkleRootFromLeafHashes(input.proof.slice(0, input.fromTreeSize)) === input.oldRoot &&
    merkleRootFromLeafHashes(input.proof) === input.newRoot
  )
}
