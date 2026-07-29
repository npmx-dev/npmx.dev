import { describe, expect, it } from 'vitest'

// `useRoute()` cannot be mocked via `mockNuxtImport` in this runtime, so instead
// we drive the app's real router. That has the upside of exercising the actual
// route definitions: if a route's param names ever change (e.g. `packageName` →
// `name`), these tests break, which is exactly what should happen since
// `usePackageRoute` reads those params.
async function at(url: string) {
  await useRouter().push(url)
  return usePackageRoute()
}

describe('usePackageRoute', () => {
  describe('package / package-version routes (`name` param)', () => {
    it('parses an unscoped package with no version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package/nuxt')
      expect(packageName.value).toBe('nuxt')
      expect(requestedVersion.value).toBeNull()
      expect(orgName.value).toBeNull()
    })

    it('parses a scoped package with a version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package/@nuxt/kit/v/1.0.0')
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBe('1.0.0')
      expect(orgName.value).toBe('nuxt')
    })
  })

  describe('code / stats / timeline routes (`packageName` param)', () => {
    it('parses the code route (scoped, with file path)', async () => {
      const { packageName, requestedVersion, orgName } = await at(
        '/package-code/@nuxt/kit/v/1.0.0/src/index.ts',
      )
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBe('1.0.0')
      expect(orgName.value).toBe('nuxt')
    })

    it('parses the stats route (unscoped)', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package-stats/nuxt/v/4.2.0')
      expect(packageName.value).toBe('nuxt')
      expect(requestedVersion.value).toBe('4.2.0')
      expect(orgName.value).toBeNull()
    })

    it('parses the timeline route (scoped)', async () => {
      const { packageName, requestedVersion, orgName } = await at(
        '/package-timeline/@nuxt/kit/v/1.0.0',
      )
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBe('1.0.0')
      expect(orgName.value).toBe('nuxt')
    })
  })

  describe('changelog routes (`name` param)', () => {
    it('parses a scoped package with a version', async () => {
      const { packageName, requestedVersion, orgName } = await at(
        '/package-changelog/@nuxt/kit/v/1.0.0',
      )
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBe('1.0.0')
      expect(orgName.value).toBe('nuxt')
    })
  })

  describe('docs route (catch-all `path` param)', () => {
    it('parses a scoped package with a version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package-docs/@nuxt/kit/v/1.0.0')
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBe('1.0.0')
      expect(orgName.value).toBe('nuxt')
    })

    it('parses an unscoped package with a version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package-docs/nuxt/v/4.2.0')
      expect(packageName.value).toBe('nuxt')
      expect(requestedVersion.value).toBe('4.2.0')
      expect(orgName.value).toBeNull()
    })

    it('parses an unscoped package with no version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package-docs/nuxt')
      expect(packageName.value).toBe('nuxt')
      expect(requestedVersion.value).toBeNull()
      expect(orgName.value).toBeNull()
    })

    it('parses a scoped package with no version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/package-docs/@nuxt/kit')
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBeNull()
      expect(orgName.value).toBe('nuxt')
    })

    it('treats a package literally named "v" as the package, not a version marker', async () => {
      const { packageName, requestedVersion } = await at('/package-docs/v')
      expect(packageName.value).toBe('v')
      expect(requestedVersion.value).toBeNull()
    })

    it('recognises the version marker only when it follows the package name', async () => {
      // package "v" at version "1.0.0": the first "v" is the name, the second is the marker
      const { packageName, requestedVersion } = await at('/package-docs/v/v/1.0.0')
      expect(packageName.value).toBe('v')
      expect(requestedVersion.value).toBe('1.0.0')
    })

    it('takes only the version segment, leaving trailing docs segments out', async () => {
      const { packageName, requestedVersion } = await at('/package-docs/nuxt/v/4.2.0/api')
      expect(packageName.value).toBe('nuxt')
      expect(requestedVersion.value).toBe('4.2.0')
    })
  })

  describe('diff route (`versionRange` param)', () => {
    it('resolves the package/org but does not treat the range as a requested version', async () => {
      const { packageName, requestedVersion, orgName } = await at('/diff/@nuxt/kit/v/1.0.0...2.0.0')
      expect(packageName.value).toBe('@nuxt/kit')
      expect(requestedVersion.value).toBeNull()
      expect(orgName.value).toBe('nuxt')
    })
  })
})
