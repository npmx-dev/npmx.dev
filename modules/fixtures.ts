import process from 'node:process'
import { addServerPlugin, createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

/**
 * Test fixtures module for mocking external API requests.
 *
 * This module intercepts server-side requests to external APIs (npm registry, etc.)
 * and serves pre-recorded fixture data instead. This ensures tests are deterministic
 * and don't depend on external API availability.
 *
 * Enabled when:
 * - `nuxt.options.test` is true (Nuxt test mode), OR
 * - `NUXT_TEST_FIXTURES=true` environment variable is set
 *
 * Set `NUXT_TEST_FIXTURES_VERBOSE=true` for detailed logging.
 *
 * Note: This only mocks server-side requests. For client-side mocking in
 * Playwright tests, see test/e2e/test-utils.ts.
 */
export default defineNuxtModule({
  meta: {
    name: 'fixtures',
  },
  setup() {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)

    if (nuxt.options.test || process.env.NUXT_TEST_FIXTURES === 'true') {
      addServerPlugin(resolver.resolve('./runtime/server/cache.ts'))

      nuxt.hook('nitro:config', nitroConfig => {
        nitroConfig.storage ||= {}
        nitroConfig.storage['fixtures'] = {
          driver: 'fsLite',
          base: resolver.resolve('../test/fixtures'),
        }
      })
    }
  },
})
