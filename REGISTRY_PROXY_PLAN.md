# Registry Proxy + SumDB Status

## Summary

This file now reflects the current implemented state.

What exists today:

- `registry.npmx.dev` is an npm-compatible proxy surface
- `sum.npmx.dev` is a minimal transparency log for immutable tarball assertions
- sumdb logs only tarball records
- every logged record includes:
  - `keyId`
  - `name`
  - `version`
  - `type`
  - `digest`
  - `size`
  - `url`
  - `integrity`
  - `signature`
- `keyId` is the actual package-signing key from npm-style `dist.signatures`
- the proxy verifies the upstream package signature before ingest
- sumdb verifies the same logged signature again using trusted public keys loaded at startup
- sumdb does not know registry base URLs, labels, or proxy-specific routes
- the proxy no longer exposes custom routes like `/registries`
- package-pattern routing has been removed; the proxy fetches from the first configured source registry

## Implemented Behavior

### 1. Registry catalog and fetch source

The checked-in registry catalog in [config/registries.ts](/Users/mohammadbagherabiyat/oss/npmx.dev/config/registries.ts) is now just an ordered list of source registries:

- `label`
- `registryBaseUrl`

Current behavior:

- source-registry keys are fetched from each registry’s `/-/npm/v1/keys`
- the full catalog is used to collect trusted public keys for startup/bootstrap
- the proxy uses the first configured registry as its fetch source
- there are no per-package or per-scope routing rules anymore

### 2. Proxy behavior

Implemented in [apps/registry-proxy/src/server.ts](/Users/mohammadbagherabiyat/oss/npmx.dev/apps/registry-proxy/src/server.ts):

- supports npm-compatible packument routes
- supports npm-compatible tarball passthrough routes
- exposes `GET /-/npm/v1/keys`
- preserves source-registry tarball URLs in packuments so lockfiles do not point at the proxy
- caches packuments on disk
- verifies upstream `dist.signatures` before ingesting a tarball into sumdb
- sends the minimal tarball record directly to sumdb

Not present anymore:

- `/registries`
- proxy-side registry registration behavior
- package-pattern routing logic
- witness/envelope signing between proxy and sumdb

### 3. SumDB behavior

Implemented in [apps/sumdb/src/server.ts](/Users/mohammadbagherabiyat/oss/npmx.dev/apps/sumdb/src/server.ts) and [apps/sumdb/src/store.ts](/Users/mohammadbagherabiyat/oss/npmx.dev/apps/sumdb/src/store.ts):

- accepts only tarball ingest records
- requires `integrity`
- verifies the logged `signature` against the trusted responsible public key for `keyId`
- rejects unknown key IDs
- stores only the minimal logged record in the Merkle tree
- serves lookup, checkpoint, inclusion proof, consistency proof, and tile endpoints
- signs checkpoints with its own npm-style P-256 keypair

Startup model:

- trusted responsible public keys are fetched outside the sumdb core
- the sumdb CLI bootstraps them from the checked-in registry catalog before creating the server
- the server/store itself remains registry-URL-agnostic

### 4. Logged record and canonical leaf

Implemented in [apps/registry-core/src/protocol.ts](/Users/mohammadbagherabiyat/oss/npmx.dev/apps/registry-core/src/protocol.ts):

Logged record fields:

- `keyId`
- `name`
- `version`
- `type`
- `digest`
- `size`
- `url`
- `integrity`
- `signature`

The Merkle leaf is built from exactly those fields and nothing else.

Why packuments are not logged:

- they are mutable registry metadata, not immutable versioned artifacts
- they do not have one stable package-version integrity value like tarballs do
- dropping them keeps sumdb closer to a Go-sumdb-style artifact log

## Public Interfaces

### Ingest API

`POST /ingest` currently accepts:

- `keyId`
- `name`
- `version`
- `type`
- `digest`
- `size`
- `url`
- `integrity`
- `signature`

Validation:

- `type` must be `tarball`
- `integrity` must be present
- `signature` must verify for `${name}@${version}:${integrity}`

### Proxy API surface

Currently exposed:

- `GET /<package>`
- `GET /@scope/<package>`
- tarball passthrough routes
- `GET /-/npm/v1/keys`

Currently not exposed:

- `/registries`
- proxy-specific registry inspection endpoints

### Sumdb API surface

Currently exposed:

- `GET /lookup/:keyId/:packageName/:version`
- `GET /latest-checkpoint`
- `GET /checkpoint/:treeSize`
- `GET /proof/inclusion/:leafIndex`
- `GET /proof/consistency/:from/:to`
- `GET /tile/...`
- `POST /ingest`

## Verification And Tests

Verified today:

- minimal-leaf and Merkle tests pass
- end-to-end proxy + sumdb install flow passes with real installs
- lockfile tarball URLs point to the source registry, not the proxy
- proxy no longer exposes `/registries`
- logged records include the upstream package signature
- sumdb verifies the logged signature using startup-loaded trusted public keys

Main test entrypoints:

- `node --test --experimental-strip-types apps/registry-core/src/*.test.ts`
- `node --test --experimental-strip-types apps/demo/src/integration.test.ts`

## Assumptions

- trust is per published signing key, not per registry hostname
- the registry catalog is the source of truth for source-registry order and external key fetching
- the first configured registry is the active fetch source for the proxy
- duplicate tarball ingests are deduplicated by canonical leaf
