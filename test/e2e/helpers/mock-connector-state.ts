/** Singleton state management for E2E tests. */

import {
  MockConnectorStateManager,
  createMockConnectorState,
  DEFAULT_MOCK_CONFIG,
  type MockConnectorConfig,
} from '../../../cli/src/mock-state.ts'

export { MockConnectorStateManager, createMockConnectorState, DEFAULT_MOCK_CONFIG }
export type { MockConnectorConfig }

let globalStateManager: MockConnectorStateManager | null = null

export function initGlobalMockState(config: MockConnectorConfig): MockConnectorStateManager {
  globalStateManager = new MockConnectorStateManager(createMockConnectorState(config))
  return globalStateManager
}

export function getGlobalMockState(): MockConnectorStateManager {
  if (!globalStateManager) {
    throw new Error('Mock connector state not initialized. Call initGlobalMockState() first.')
  }
  return globalStateManager
}

export function resetGlobalMockState(): void {
  globalStateManager?.reset()
}
