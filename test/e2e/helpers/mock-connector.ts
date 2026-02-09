/**
 * Mock connector HTTP server for E2E testing.
 *
 * This server implements the same API as the real connector CLI,
 * allowing Playwright tests to exercise authenticated features
 * without requiring the real connector to be running.
 */

import type { H3Event } from 'h3-next'
import {
  createApp,
  createRouter,
  eventHandler,
  readBody,
  getQuery,
  getRouterParam,
  setResponseStatus,
  toNodeListener,
  handleCors,
  type CorsOptions,
} from 'h3-next'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  type MockConnectorConfig,
  type MockConnectorStateManager,
  type OperationType,
  initGlobalMockState,
} from './mock-connector-state'

// CORS options to allow requests from any localhost origin
const corsOptions: CorsOptions = {
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}

/**
 * Creates the H3 app that implements the connector API.
 */
function createMockConnectorApp(stateManager: MockConnectorStateManager) {
  const app = createApp()
  const router = createRouter()

  // Handle CORS for all requests (including preflight)
  app.use(
    eventHandler(event => {
      const corsResult = handleCors(event, corsOptions)
      if (corsResult !== false) {
        return corsResult
      }
    }),
  )

  // Auth middleware helper
  const requireAuth = (event: H3Event) => {
    const authHeader = event.node?.req?.headers?.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Authorization required' }
    }
    const token = authHeader.slice(7)
    if (token !== stateManager.token) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Invalid token' }
    }
    if (!stateManager.isConnected()) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Not connected' }
    }
    return null // Auth passed
  }

  // POST /connect - Validate token and establish connection
  router.post(
    '/connect',
    eventHandler(async event => {
      const body = await readBody<{ token?: string }>(event)
      const token = body?.token

      if (!token || token !== stateManager.token) {
        setResponseStatus(event, 401)
        return { success: false, error: 'Invalid token' }
      }

      stateManager.connect(token)

      return {
        success: true,
        data: {
          npmUser: stateManager.config.npmUser,
          avatar: stateManager.config.avatar ?? null,
          connectedAt: stateManager.state.connectedAt,
        },
      }
    }),
  )

  // GET /state - Get current session state
  router.get(
    '/state',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      return {
        success: true,
        data: {
          npmUser: stateManager.config.npmUser,
          avatar: stateManager.config.avatar ?? null,
          operations: stateManager.getOperations(),
        },
      }
    }),
  )

  // POST /operations - Add a single operation
  router.post(
    '/operations',
    eventHandler(async event => {
      const authError = requireAuth(event)
      if (authError) return authError

      interface OperationBody {
        type?: string
        params?: Record<string, string>
        description?: string
        command?: string
        dependsOn?: string
      }
      const body = await readBody<OperationBody>(event)
      if (!body || !body.type || !body.description || !body.command) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing required fields' }
      }

      const operation = stateManager.addOperation({
        type: body.type as OperationType,
        params: body.params ?? {},
        description: body.description,
        command: body.command,
        dependsOn: body.dependsOn,
      })

      return { success: true, data: operation }
    }),
  )

  // POST /operations/batch - Add multiple operations
  router.post(
    '/operations/batch',
    eventHandler(async event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const body = await readBody(event)
      if (!Array.isArray(body)) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Expected array of operations' }
      }

      const operations = stateManager.addOperations(body)
      return { success: true, data: operations }
    }),
  )

  // DELETE /operations?id=<id> - Remove a single operation
  router.delete(
    '/operations',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const query = getQuery(event)
      const id = query.id as string
      if (!id) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing operation id' }
      }

      const removed = stateManager.removeOperation(id)
      if (!removed) {
        setResponseStatus(event, 404)
        return { success: false, error: 'Operation not found or cannot be removed' }
      }

      return { success: true }
    }),
  )

  // DELETE /operations/all - Clear all non-running operations
  router.delete(
    '/operations/all',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const removed = stateManager.clearOperations()
      return { success: true, data: { removed } }
    }),
  )

  // POST /approve?id=<id> - Approve a single operation
  router.post(
    '/approve',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const query = getQuery(event)
      const id = query.id as string
      if (!id) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing operation id' }
      }

      const operation = stateManager.approveOperation(id)
      if (!operation) {
        setResponseStatus(event, 404)
        return { success: false, error: 'Operation not found or not pending' }
      }

      return { success: true, data: operation }
    }),
  )

  // POST /approve-all - Approve all pending operations
  router.post(
    '/approve-all',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const approved = stateManager.approveAll()
      return { success: true, data: { approved } }
    }),
  )

  // POST /retry?id=<id> - Retry a failed operation
  router.post(
    '/retry',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const query = getQuery(event)
      const id = query.id as string
      if (!id) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing operation id' }
      }

      const operation = stateManager.retryOperation(id)
      if (!operation) {
        setResponseStatus(event, 404)
        return { success: false, error: 'Operation not found or not failed' }
      }

      return { success: true, data: operation }
    }),
  )

  // POST /execute - Execute all approved operations
  router.post(
    '/execute',
    eventHandler(async event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const body = await readBody<{ otp?: string }>(event).catch(() => ({ otp: undefined }))
      const otp = body?.otp

      const { results, otpRequired } = stateManager.executeOperations({ otp })

      return {
        success: true,
        data: { results, otpRequired },
      }
    }),
  )

  // GET /org/:org/users - List org members
  router.get(
    '/org/:org/users',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const org = getRouterParam(event, 'org')
      if (!org) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing org parameter' }
      }

      // Normalize org name: add @ prefix if not present (for internal lookup)
      const normalizedOrg = org.startsWith('@') ? org : `@${org}`

      const users = stateManager.getOrgUsers(normalizedOrg)
      if (users === null) {
        // Return empty object for unknown orgs (simulates no access)
        return { success: true, data: {} }
      }

      return { success: true, data: users }
    }),
  )

  // GET /org/:org/teams - List org teams
  router.get(
    '/org/:org/teams',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const org = getRouterParam(event, 'org')
      if (!org) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing org parameter' }
      }

      // Normalize org name: add @ prefix if not present
      const normalizedOrg = org.startsWith('@') ? org : `@${org}`
      // Extract org name without @ prefix for formatting team names
      const orgName = normalizedOrg.slice(1)

      const teams = stateManager.getOrgTeams(normalizedOrg)
      // Return teams in "org:team" format (matching real npm team ls output)
      const formattedTeams = teams ? teams.map(t => `${orgName}:${t}`) : []
      return { success: true, data: formattedTeams }
    }),
  )

  // GET /team/:scopeTeam/users - List team members
  router.get(
    '/team/:scopeTeam/users',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const scopeTeam = getRouterParam(event, 'scopeTeam')
      if (!scopeTeam) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing scopeTeam parameter' }
      }

      // Format: @scope:team
      if (!scopeTeam.startsWith('@') || !scopeTeam.includes(':')) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Invalid scope:team format (expected @scope:team)' }
      }

      const [scope, team] = scopeTeam.split(':')
      if (!scope || !team) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Invalid scope:team format' }
      }

      const users = stateManager.getTeamUsers(scope, team)
      return { success: true, data: users ?? [] }
    }),
  )

  // GET /package/:pkg/collaborators - List package collaborators
  router.get(
    '/package/:pkg/collaborators',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const pkg = getRouterParam(event, 'pkg')
      if (!pkg) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing package parameter' }
      }

      // Decode the package name (scoped packages like @nuxt/kit come URL-encoded)
      const decodedPkg = decodeURIComponent(pkg)
      const collaborators = stateManager.getPackageCollaborators(decodedPkg)
      return { success: true, data: collaborators ?? {} }
    }),
  )

  // GET /user/packages - List user's packages
  router.get(
    '/user/packages',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const packages = stateManager.getUserPackages()
      return { success: true, data: packages }
    }),
  )

  // GET /user/orgs - List user's orgs
  router.get(
    '/user/orgs',
    eventHandler(event => {
      const authError = requireAuth(event)
      if (authError) return authError

      const orgs = stateManager.getUserOrgs()
      return { success: true, data: orgs }
    }),
  )

  // ============ Test-only endpoints for setting up mock data ============

  // POST /__test__/reset - Reset all mock state
  router.post(
    '/__test__/reset',
    eventHandler(() => {
      stateManager.reset()
      return { success: true }
    }),
  )

  // POST /__test__/org - Set org data
  router.post(
    '/__test__/org',
    eventHandler(async event => {
      interface OrgSetupBody {
        org: string
        users?: Record<string, 'developer' | 'admin' | 'owner'>
        teams?: string[]
        teamMembers?: Record<string, string[]>
      }
      const body = await readBody<OrgSetupBody>(event)
      if (!body?.org) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing org parameter' }
      }

      stateManager.setOrgData(body.org, {
        users: body.users,
        teams: body.teams,
        teamMembers: body.teamMembers,
      })

      return { success: true }
    }),
  )

  // POST /__test__/user-orgs - Set user's orgs
  router.post(
    '/__test__/user-orgs',
    eventHandler(async event => {
      const body = await readBody<{ orgs: string[] }>(event)
      if (!body?.orgs) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing orgs parameter' }
      }

      stateManager.setUserOrgs(body.orgs)
      return { success: true }
    }),
  )

  // POST /__test__/user-packages - Set user's packages
  router.post(
    '/__test__/user-packages',
    eventHandler(async event => {
      const body = await readBody<{ packages: Record<string, 'read-only' | 'read-write'> }>(event)
      if (!body?.packages) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing packages parameter' }
      }

      stateManager.setUserPackages(body.packages)
      return { success: true }
    }),
  )

  // POST /__test__/package - Set package data
  router.post(
    '/__test__/package',
    eventHandler(async event => {
      interface PackageSetupBody {
        package: string
        collaborators?: Record<string, 'read-only' | 'read-write'>
      }
      const body = await readBody<PackageSetupBody>(event)
      if (!body?.package) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Missing package parameter' }
      }

      stateManager.setPackageData(body.package, {
        collaborators: body.collaborators ?? {},
      })

      return { success: true }
    }),
  )

  app.use(router.handler)
  return app
}

/**
 * Mock connector server instance.
 */
export class MockConnectorServer {
  private server: Server | null = null
  private stateManager: MockConnectorStateManager

  constructor(config: MockConnectorConfig) {
    this.stateManager = initGlobalMockState(config)
  }

  /**
   * Start the mock server.
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Mock connector server is already running')
    }

    const app = createMockConnectorApp(this.stateManager)
    this.server = createServer(toNodeListener(app))

    return new Promise((resolve, reject) => {
      const port = this.stateManager.port

      this.server!.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${port} is already in use. Is the real connector running?`))
        } else {
          reject(err)
        }
      })

      this.server!.listen(port, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo
        console.log(`[Mock Connector] Started on http://127.0.0.1:${addr.port}`)
        resolve()
      })
    })
  }

  /**
   * Stop the mock server.
   */
  async stop(): Promise<void> {
    if (!this.server) return

    return new Promise((resolve, reject) => {
      this.server!.close(err => {
        if (err) {
          reject(err)
        } else {
          console.log('[Mock Connector] Stopped')
          this.server = null
          resolve()
        }
      })
    })
  }

  /**
   * Get the state manager for test setup.
   */
  get state(): MockConnectorStateManager {
    return this.stateManager
  }

  /**
   * Get the port the server is running on.
   */
  get port(): number {
    return this.stateManager.port
  }

  /**
   * Get the token for authentication.
   */
  get token(): string {
    return this.stateManager.token
  }

  /**
   * Reset state between tests.
   */
  reset(): void {
    this.stateManager.reset()
  }
}

// Export a function to get the global state manager (for tests that need to manipulate state)
export {
  getGlobalMockState,
  resetGlobalMockState,
  DEFAULT_MOCK_CONFIG,
} from './mock-connector-state'

// Alias for backward compatibility
export { DEFAULT_MOCK_CONFIG as DEFAULT_TEST_CONFIG } from './mock-connector-state'
