/**
 * Re-export from shared test utilities for backward compatibility.
 * The actual implementation is in shared/test-utils/ for use by both
 * Playwright E2E tests and Vitest browser tests.
 */

export {
  // Types
  type OrgRole,
  type AccessLevel,
  type MockConnectorConfig,
  type MockOrgData,
  type MockPackageData,
  type MockConnectorStateData as MockConnectorState,
  type NewOperationInput,
  type ExecuteOptions,
  type ExecuteResult,
  type PendingOperation,
  type OperationType,
  type OperationResult,

  // State management
  MockConnectorStateManager,
  createMockConnectorState,
  DEFAULT_MOCK_CONFIG,
} from '../../shared/test-utils'

// Singleton management for the mock server
import {
  MockConnectorStateManager,
  createMockConnectorState,
  DEFAULT_MOCK_CONFIG,
  type MockConnectorConfig,
} from '../../shared/test-utils'

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
