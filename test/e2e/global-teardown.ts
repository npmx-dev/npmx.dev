/**
 * Playwright global teardown - stops the mock connector server after all tests.
 */

import type { MockConnectorServer } from './helpers/mock-connector'

export default async function globalTeardown() {
  console.log('[Global Teardown] Stopping mock connector server...')

  const mockServer = (globalThis as Record<string, unknown>).__mockConnectorServer as
    | MockConnectorServer
    | undefined

  if (mockServer) {
    try {
      await mockServer.stop()
      delete (globalThis as Record<string, unknown>).__mockConnectorServer
    } catch (error) {
      console.error('[Global Teardown] Error stopping mock connector:', error)
    }
  } else {
    console.log('[Global Teardown] No mock connector server found')
  }
}
