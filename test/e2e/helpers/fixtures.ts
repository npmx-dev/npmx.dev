/**
 * Playwright test fixtures for connector-related tests.
 *
 * These fixtures extend the base Nuxt test utilities with
 * connector-specific helpers.
 */

import { test as base } from '@nuxt/test-utils/playwright'
import { DEFAULT_TEST_CONFIG } from './mock-connector'

/** The test token for authentication */
const TEST_TOKEN = DEFAULT_TEST_CONFIG.token
/** The connector port */
const TEST_PORT = DEFAULT_TEST_CONFIG.port ?? 31415

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
    return response.json() as Promise<T>
  }

  /** Reset the mock connector state */
  async reset(): Promise<void> {
    // Reset state via test endpoint (no auth required)
    await fetch(`${this.baseUrl}/__test__/reset`, { method: 'POST' })

    // Connect to establish session
    await fetch(`${this.baseUrl}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.token }),
    })
  }

  /** Set org data */
  async setOrgData(
    org: string,
    data: {
      users?: Record<string, 'developer' | 'admin' | 'owner'>
      teams?: string[]
      teamMembers?: Record<string, string[]>
    },
  ): Promise<void> {
    await fetch(`${this.baseUrl}/__test__/org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org, ...data }),
    })
  }

  /** Set user orgs */
  async setUserOrgs(orgs: string[]): Promise<void> {
    await fetch(`${this.baseUrl}/__test__/user-orgs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgs }),
    })
  }

  /** Set user packages */
  async setUserPackages(packages: Record<string, 'read-only' | 'read-write'>): Promise<void> {
    await fetch(`${this.baseUrl}/__test__/user-packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages }),
    })
  }

  /** Set package data */
  async setPackageData(
    pkg: string,
    data: { collaborators?: Record<string, 'read-only' | 'read-write'> },
  ): Promise<void> {
    await fetch(`${this.baseUrl}/__test__/package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: pkg, ...data }),
    })
  }

  /** Add an operation */
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

  /** Get all operations */
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
  /** Client to interact with the mock connector server */
  mockConnector: MockConnectorClient
  /** The test token for authentication */
  testToken: string
  /** The connector port */
  connectorPort: number
  /**
   * Navigate to a page with connector credentials in URL params.
   * This triggers auto-connection on page load.
   */
  gotoConnected: (path: string) => Promise<void>
}

/**
 * Extended test with connector fixtures.
 */
export const test = base.extend<ConnectorFixtures>({
  mockConnector: async ({ page: _ }, use) => {
    const client = new MockConnectorClient(TEST_TOKEN, TEST_PORT)
    // Reset state before each test
    await client.reset()
    await use(client)
  },

  testToken: TEST_TOKEN,

  connectorPort: TEST_PORT,

  gotoConnected: async ({ goto, testToken, connectorPort }, use) => {
    const navigateConnected = async (path: string) => {
      // Remove leading slash if present for clean URL construction
      const cleanPath = path.startsWith('/') ? path : `/${path}`
      const separator = cleanPath.includes('?') ? '&' : '?'
      const urlWithParams = `${cleanPath}${separator}token=${testToken}&port=${connectorPort}`
      await goto(urlWithParams, { waitUntil: 'networkidle' })
    }
    await use(navigateConnected)
  },
})

export { expect } from '@nuxt/test-utils/playwright'
