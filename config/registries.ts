export interface ConfiguredRegistrySource {
  label: string
  registryBaseUrl: string
}

// This is the repo-level source of truth for source registries.
// Runtime code resolves trust identities by fetching each registry's /-/npm/v1/keys,
// so hostnames here are only discovery inputs and not the final trust identity.
export const registryCatalog: ConfiguredRegistrySource[] = [
  {
    label: 'yarn',
    registryBaseUrl: 'https://registry.yarnpkg.com',
  },
  {
    label: 'npm',
    registryBaseUrl: 'https://registry.npmjs.org',
  },
]
