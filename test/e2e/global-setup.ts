/**
 * Playwright global setup - starts the mock connector server before all tests.
 *
 * Returns an async teardown function (Playwright's recommended pattern for
 * sharing state between setup and teardown via closure).
 */

// eslint-disable no-console

import { MockConnectorServer, DEFAULT_MOCK_CONFIG } from './helpers/mock-connector'

export default async function globalSetup() {
  console.log('[Global Setup] Starting mock connector server...')

  const mockServer = new MockConnectorServer(DEFAULT_MOCK_CONFIG)

  try {
    await mockServer.start()
    console.log(`[Global Setup] Mock connector ready at http://127.0.0.1:${mockServer.port}`)
    console.log(`[Global Setup] Test token: ${mockServer.token}`)
  } catch (error) {
    console.error('[Global Setup] Failed to start mock connector:', error)
    throw error
  }

  // Return teardown function — Playwright calls this after all tests complete
  return async () => {
    console.log('[Global Teardown] Stopping mock connector server...')
    try {
      await mockServer.stop()
    } catch (error) {
      console.error('[Global Teardown] Error stopping mock connector:', error)
    }
  }
}
