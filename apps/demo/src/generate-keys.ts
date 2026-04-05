import { generateRegistryKeyPair } from '../../registry-core/src/index.ts'

const sumDb = generateRegistryKeyPair()
const registry = generateRegistryKeyPair()

console.log('# SumDB')
console.log(`SUMDB_PUBLIC_KEY<<'EOF'\n${sumDb.publicKeyPem}EOF`)
console.log(`SUMDB_PRIVATE_KEY<<'EOF'\n${sumDb.privateKeyPem}EOF`)
console.log(`SUMDB_KEY_ID=${sumDb.keyId}`)
console.log('')
console.log('# Registry proxy')
console.log(`REGISTRY_PUBLIC_KEY<<'EOF'\n${registry.publicKeyPem}EOF`)
console.log(`REGISTRY_PRIVATE_KEY<<'EOF'\n${registry.privateKeyPem}EOF`)
console.log(`REGISTRY_KEY_ID=${registry.keyId}`)
