import type { NpmKey } from './crypto.ts'
import type { SourceRegistry } from './protocol.ts'

export interface ConfiguredSourceRegistry {
  label: string
  registryBaseUrl: string
  npmKeys?: NpmKey[]
}

export async function fetchRegistryKeys(registryBaseUrl: string): Promise<NpmKey[]> {
  const response = await fetch(`${registryBaseUrl}/-/npm/v1/keys`)
  if (!response.ok) {
    throw new Error(`Unable to fetch keys for ${registryBaseUrl}: ${response.status}`)
  }

  const payload = (await response.json()) as { keys?: NpmKey[] }
  if (!payload.keys?.length) {
    throw new Error(`Registry ${registryBaseUrl} did not return any keys`)
  }

  return payload.keys
}

export async function hydrateSourceRegistries(
  configured: ConfiguredSourceRegistry[],
  fallbackUpstreamBaseUrl?: string,
): Promise<SourceRegistry[]> {
  const effective =
    configured.length > 0
      ? configured
      : [
          {
            label: 'npm',
            registryBaseUrl: fallbackUpstreamBaseUrl ?? 'https://registry.npmjs.org',
          },
        ]

  return await Promise.all(
    effective.map(async registry => ({
      label: registry.label,
      registryBaseUrl: registry.registryBaseUrl,
      keysEndpoint: `${registry.registryBaseUrl}/-/npm/v1/keys`,
      npmKeys: registry.npmKeys ?? (await fetchRegistryKeys(registry.registryBaseUrl)),
    })),
  )
}

export function collectPublishedKeys(registries: SourceRegistry[]): NpmKey[] {
  const keys = new Map<string, NpmKey>()

  for (const registry of registries) {
    for (const key of registry.npmKeys) {
      if (!keys.has(key.keyid)) {
        keys.set(key.keyid, key)
      }
    }
  }

  return [...keys.values()].sort((left, right) => left.keyid.localeCompare(right.keyid))
}
