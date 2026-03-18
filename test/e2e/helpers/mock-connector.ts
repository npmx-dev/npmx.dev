/**
 * E2E mock connector server. Wraps the base server from cli/src/mock-app.ts
 * with global singleton state for Playwright test isolation.
 */

import { MockConnectorServer as BaseMockConnectorServer } from '../../../cli/src/mock-app.ts'
import { type MockConnectorConfig, initGlobalMockState } from './mock-connector-state'

export class MockConnectorServer {
  private baseServer: BaseMockConnectorServer

  constructor(config: MockConnectorConfig) {
    const stateManager = initGlobalMockState(config)
    this.baseServer = new BaseMockConnectorServer(stateManager)
  }

  async start(): Promise<void> {
    return this.baseServer.start()
  }

  async stop(): Promise<void> {
    return this.baseServer.stop()
  }

  get state() {
    return this.baseServer.state
  }

  get port(): number {
    return this.baseServer.port
  }

  get token(): string {
    return this.baseServer.token
  }

  reset(): void {
    this.baseServer.reset()
  }
}

export {
  getGlobalMockState,
  resetGlobalMockState,
  DEFAULT_MOCK_CONFIG,
} from './mock-connector-state'
