/**
 * Playwright fixtures for connector E2E tests. Extends test-utils.ts
 * (which includes external API mocking) with connector-specific helpers.
 */

import { test as base } from '../test-utils'
import { DEFAULT_MOCK_CONFIG } from './mock-connector'

const TEST_TOKEN = DEFAULT_MOCK_CONFIG.token
const TEST_PORT = DEFAULT_MOCK_CONFIG.port ?? 31415

/**
 * Helper to make requests to the mock connector server.
 * This allows tests to set up state before running.
 */
export class MockConnectorClient {
  private token: string
  private baseUrl: string

  constructor(token: string, port: number) {
    this.token = token
    this.baseUrl = `http://127.0.0.1:${port}`
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers,
      },
    })
    if (!response.ok) {
      throw new Error(
        `Mock connector request failed: ${response.status} ${response.statusText} (${path})`,
      )
    }
    return response.json() as Promise<T>
  }

  private async testEndpoint(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(
        `Mock connector test endpoint failed: ${response.status} ${response.statusText} (${path})`,
      )
    }
  }

  async reset(): Promise<void> {
    await this.testEndpoint('/__test__/reset', {})
    await this.testEndpoint('/connect', { token: this.token })
  }

  async setOrgData(
    org: string,
    data: {
      users?: Record<string, 'developer' | 'admin' | 'owner'>
      teams?: string[]
      teamMembers?: Record<string, string[]>
    },
  ): Promise<void> {
    await this.testEndpoint('/__test__/org', { org, ...data })
  }

  async setUserOrgs(orgs: string[]): Promise<void> {
    await this.testEndpoint('/__test__/user-orgs', { orgs })
  }

  async setUserPackages(packages: Record<string, 'read-only' | 'read-write'>): Promise<void> {
    await this.testEndpoint('/__test__/user-packages', { packages })
  }

  async setPackageData(
    pkg: string,
    data: { collaborators?: Record<string, 'read-only' | 'read-write'> },
  ): Promise<void> {
    await this.testEndpoint('/__test__/package', { package: pkg, ...data })
  }

  async addOperation(operation: {
    type: string
    params: Record<string, string>
    description: string
    command: string
    dependsOn?: string
  }): Promise<{ id: string; status: string }> {
    const result = await this.request<{ success: boolean; data: { id: string; status: string } }>(
      '/operations',
      {
        method: 'POST',
        body: JSON.stringify(operation),
      },
    )
    return result.data
  }

  async getOperations(): Promise<
    Array<{ id: string; type: string; status: string; params: Record<string, string> }>
  > {
    const result = await this.request<{
      success: boolean
      data: {
        operations: Array<{
          id: string
          type: string
          status: string
          params: Record<string, string>
        }>
      }
    }>('/state')
    return result.data.operations
  }
}

export interface ConnectorFixtures {
  mockConnector: MockConnectorClient
  testToken: string
  connectorPort: number
  /** Navigate to a page pre-authenticated with connector credentials. */
  gotoConnected: (path: string) => Promise<void>
}

export const test = base.extend<ConnectorFixtures>({
  mockConnector: async ({ page: _ }, use) => {
    const client = new MockConnectorClient(TEST_TOKEN, TEST_PORT)
    await client.reset()
    await use(client)
  },

  testToken: TEST_TOKEN,

  connectorPort: TEST_PORT,

  gotoConnected: async ({ goto, testToken, connectorPort }, use) => {
    const navigateConnected = async (path: string) => {
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const separator = cleanPath.includes('?') ? '&' : '?'
      const urlWithParams = `${cleanPath}${separator}token=${testToken}&port=${connectorPort}`
      await goto(urlWithParams, { waitUntil: 'networkidle' })
    }
    await use(navigateConnected)
  },
})

export { expect } from '@nuxt/test-utils/playwright'
