/**
 * Playwright global setup - starts the mock connector server before all tests.
 */

import { MockConnectorServer, DEFAULT_TEST_CONFIG } from './helpers/mock-connector'

let mockServer: MockConnectorServer | null = null

export default async function globalSetup() {
  console.log('[Global Setup] Starting mock connector server...')

  mockServer = new MockConnectorServer(DEFAULT_TEST_CONFIG)

  try {
    await mockServer.start()
    console.log(`[Global Setup] Mock connector ready at http://127.0.0.1:${mockServer.port}`)
    console.log(`[Global Setup] Test token: ${mockServer.token}`)

    // Store the server instance for global teardown
    ;(globalThis as Record<string, unknown>).__mockConnectorServer = mockServer
  } catch (error) {
    console.error('[Global Setup] Failed to start mock connector:', error)
    throw error
  }
}
