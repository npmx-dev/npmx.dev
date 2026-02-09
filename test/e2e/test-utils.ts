import type { Page, Route } from '@playwright/test'
import { test as base } from '@nuxt/test-utils/playwright'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mockRoutes = require('../fixtures/mock-routes.cjs')

/**
 * Fail the test with a clear error message when an external API request isn't mocked.
 */
function failUnmockedRequest(route: Route, apiName: string): never {
  const url = route.request().url()
  const error = new Error(
    `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `UNMOCKED EXTERNAL API REQUEST DETECTED\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `\n` +
      `API:  ${apiName}\n` +
      `URL:  ${url}\n` +
      `\n` +
      `This request would hit a real external API, which is not allowed in tests.\n` +
      `\n` +
      `To fix this, either:\n` +
      `  1. Add a fixture file for this request in test/fixtures/\n` +
      `  2. Add handling for this URL pattern in test/fixtures/mock-routes.cjs\n` +
      `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
  )
  throw error
}

async function setupRouteMocking(page: Page): Promise<void> {
  for (const routeDef of mockRoutes.routes) {
    await page.route(routeDef.pattern, async (route: Route) => {
      const url = route.request().url()
      const result = mockRoutes.matchRoute(url)

      if (result) {
        await route.fulfill({
          status: result.response.status,
          contentType: result.response.contentType,
          body: result.response.body,
        })
      } else {
        failUnmockedRequest(route, routeDef.name)
      }
    })
  }
}

/**
 * Extended test fixture with automatic external API mocking.
 *
 * All external API requests are intercepted and served from fixtures.
 * If a request cannot be mocked, the test will fail with a clear error.
 */
export const test = base.extend<{ mockExternalApis: void }>({
  mockExternalApis: [
    async ({ page }, use) => {
      await setupRouteMocking(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@nuxt/test-utils/playwright'
