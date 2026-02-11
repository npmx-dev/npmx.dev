/**
 * Mock connector H3 application. Same API as the real server (server.ts)
 * but backed by in-memory state. Used by the mock CLI and E2E tests.
 */

import { H3, HTTPError, handleCors, type H3Event } from 'h3-next'
import type { CorsOptions } from 'h3-next'
import { serve, type Server } from 'srvx'
import type {
  OperationType,
  ApiResponse,
  ConnectorEndpoints,
  AssertEndpointsImplemented,
} from './types.ts'
import type { MockConnectorStateManager } from './mock-state.ts'

// Endpoint completeness check — errors if this list diverges from ConnectorEndpoints.
// oxlint-disable-next-line no-unused-vars
const _endpointCheck: AssertEndpointsImplemented<
  | 'POST /connect'
  | 'GET /state'
  | 'POST /operations'
  | 'POST /operations/batch'
  | 'DELETE /operations'
  | 'DELETE /operations/all'
  | 'POST /approve'
  | 'POST /approve-all'
  | 'POST /retry'
  | 'POST /execute'
  | 'GET /org/:org/users'
  | 'GET /org/:org/teams'
  | 'GET /team/:scopeTeam/users'
  | 'GET /package/:pkg/collaborators'
  | 'GET /user/packages'
  | 'GET /user/orgs'
> = true
void _endpointCheck

const corsOptions: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}

function createMockConnectorApp(stateManager: MockConnectorStateManager) {
  const app = new H3()

  app.use((event: H3Event) => {
    const corsResult = handleCors(event, corsOptions)
    if (corsResult !== false) {
      return corsResult
    }
  })

  function requireAuth(event: H3Event): void {
    const authHeader = event.req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPError({ statusCode: 401, message: 'Authorization required' })
    }
    const token = authHeader.slice(7)
    if (token !== stateManager.token) {
      throw new HTTPError({ statusCode: 401, message: 'Invalid token' })
    }
    if (!stateManager.isConnected()) {
      throw new HTTPError({ statusCode: 401, message: 'Not connected' })
    }
  }

  // POST /connect
  app.post('/connect', async (event: H3Event) => {
    const body = (await event.req.json()) as { token?: string }
    const token = body?.token

    if (!token || token !== stateManager.token) {
      throw new HTTPError({ statusCode: 401, message: 'Invalid token' })
    }

    stateManager.connect(token)

    return {
      success: true,
      data: {
        npmUser: stateManager.config.npmUser,
        avatar: stateManager.config.avatar ?? null,
        connectedAt: stateManager.state.connectedAt ?? Date.now(),
      },
    } satisfies ApiResponse<ConnectorEndpoints['POST /connect']['data']>
  })

  // GET /state
  app.get('/state', (event: H3Event) => {
    requireAuth(event)

    return {
      success: true,
      data: {
        npmUser: stateManager.config.npmUser,
        avatar: stateManager.config.avatar ?? null,
        operations: stateManager.getOperations(),
      },
    } satisfies ApiResponse<ConnectorEndpoints['GET /state']['data']>
  })

  // POST /operations
  app.post('/operations', async (event: H3Event) => {
    requireAuth(event)

    const body = (await event.req.json()) as {
      type?: string
      params?: Record<string, string>
      description?: string
      command?: string
      dependsOn?: string
    }
    if (!body?.type || !body.description || !body.command) {
      throw new HTTPError({ statusCode: 400, message: 'Missing required fields' })
    }

    const operation = stateManager.addOperation({
      type: body.type as OperationType,
      params: body.params ?? {},
      description: body.description,
      command: body.command,
      dependsOn: body.dependsOn,
    })

    return {
      success: true,
      data: operation,
    } satisfies ApiResponse<ConnectorEndpoints['POST /operations']['data']>
  })

  // POST /operations/batch
  app.post('/operations/batch', async (event: H3Event) => {
    requireAuth(event)

    const body = await event.req.json()
    if (!Array.isArray(body)) {
      throw new HTTPError({ statusCode: 400, message: 'Expected array of operations' })
    }

    const operations = stateManager.addOperations(body)
    return {
      success: true,
      data: operations,
    } satisfies ApiResponse<ConnectorEndpoints['POST /operations/batch']['data']>
  })

  // DELETE /operations?id=<id>
  app.delete('/operations', (event: H3Event) => {
    requireAuth(event)

    const id = new URL(event.req.url).searchParams.get('id')
    if (!id) {
      throw new HTTPError({ statusCode: 400, message: 'Missing operation id' })
    }

    const removed = stateManager.removeOperation(id)
    if (!removed) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found or cannot be removed' })
    }

    return { success: true } satisfies ApiResponse<ConnectorEndpoints['DELETE /operations']['data']>
  })

  // DELETE /operations/all
  app.delete('/operations/all', (event: H3Event) => {
    requireAuth(event)

    const removed = stateManager.clearOperations()
    return {
      success: true,
      data: { removed },
    } satisfies ApiResponse<ConnectorEndpoints['DELETE /operations/all']['data']>
  })

  // POST /approve?id=<id>
  app.post('/approve', (event: H3Event) => {
    requireAuth(event)

    const id = new URL(event.req.url).searchParams.get('id')
    if (!id) {
      throw new HTTPError({ statusCode: 400, message: 'Missing operation id' })
    }

    const operation = stateManager.approveOperation(id)
    if (!operation) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found or not pending' })
    }

    return {
      success: true,
      data: operation,
    } satisfies ApiResponse<ConnectorEndpoints['POST /approve']['data']>
  })

  // POST /approve-all
  app.post('/approve-all', (event: H3Event) => {
    requireAuth(event)

    const approved = stateManager.approveAll()
    return {
      success: true,
      data: { approved },
    } satisfies ApiResponse<ConnectorEndpoints['POST /approve-all']['data']>
  })

  // POST /retry?id=<id>
  app.post('/retry', (event: H3Event) => {
    requireAuth(event)

    const id = new URL(event.req.url).searchParams.get('id')
    if (!id) {
      throw new HTTPError({ statusCode: 400, message: 'Missing operation id' })
    }

    const operation = stateManager.retryOperation(id)
    if (!operation) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found or not failed' })
    }

    return {
      success: true,
      data: operation,
    } satisfies ApiResponse<ConnectorEndpoints['POST /retry']['data']>
  })

  // POST /execute
  app.post('/execute', async (event: H3Event) => {
    requireAuth(event)

    const body = await event.req.json().catch(() => ({}))
    const otp = (body as { otp?: string })?.otp

    const { results, otpRequired } = stateManager.executeOperations({ otp })

    return {
      success: true,
      data: { results, otpRequired },
    } satisfies ApiResponse<ConnectorEndpoints['POST /execute']['data']>
  })

  // GET /org/:org/users
  app.get('/org/:org/users', (event: H3Event) => {
    requireAuth(event)

    const org = event.context.params?.org
    if (!org) {
      throw new HTTPError({ statusCode: 400, message: 'Missing org parameter' })
    }

    const normalizedOrg = org.startsWith('@') ? org : `@${org}`
    const users = stateManager.getOrgUsers(normalizedOrg)
    if (users === null) {
      return { success: true, data: {} } satisfies ApiResponse<
        ConnectorEndpoints['GET /org/:org/users']['data']
      >
    }

    return { success: true, data: users } satisfies ApiResponse<
      ConnectorEndpoints['GET /org/:org/users']['data']
    >
  })

  // GET /org/:org/teams
  app.get('/org/:org/teams', (event: H3Event) => {
    requireAuth(event)

    const org = event.context.params?.org
    if (!org) {
      throw new HTTPError({ statusCode: 400, message: 'Missing org parameter' })
    }

    const normalizedOrg = org.startsWith('@') ? org : `@${org}`
    const orgName = normalizedOrg.slice(1)

    const teams = stateManager.getOrgTeams(normalizedOrg)
    const formattedTeams = teams ? teams.map(t => `${orgName}:${t}`) : []
    return { success: true, data: formattedTeams } satisfies ApiResponse<
      ConnectorEndpoints['GET /org/:org/teams']['data']
    >
  })

  // GET /team/:scopeTeam/users
  app.get('/team/:scopeTeam/users', (event: H3Event) => {
    requireAuth(event)

    const scopeTeam = event.context.params?.scopeTeam
    if (!scopeTeam) {
      throw new HTTPError({ statusCode: 400, message: 'Missing scopeTeam parameter' })
    }

    if (!scopeTeam.startsWith('@') || !scopeTeam.includes(':')) {
      throw new HTTPError({
        statusCode: 400,
        message: 'Invalid scope:team format (expected @scope:team)',
      })
    }

    const [scope, team] = scopeTeam.split(':')
    if (!scope || !team) {
      throw new HTTPError({ statusCode: 400, message: 'Invalid scope:team format' })
    }

    const users = stateManager.getTeamUsers(scope, team)
    return { success: true, data: users ?? [] } satisfies ApiResponse<
      ConnectorEndpoints['GET /team/:scopeTeam/users']['data']
    >
  })

  // GET /package/:pkg/collaborators
  app.get('/package/:pkg/collaborators', (event: H3Event) => {
    requireAuth(event)

    const pkg = event.context.params?.pkg
    if (!pkg) {
      throw new HTTPError({ statusCode: 400, message: 'Missing package parameter' })
    }

    const collaborators = stateManager.getPackageCollaborators(decodeURIComponent(pkg))
    return { success: true, data: collaborators ?? {} } satisfies ApiResponse<
      ConnectorEndpoints['GET /package/:pkg/collaborators']['data']
    >
  })

  // GET /user/packages
  app.get('/user/packages', (event: H3Event) => {
    requireAuth(event)

    const packages = stateManager.getUserPackages()
    return { success: true, data: packages } satisfies ApiResponse<
      ConnectorEndpoints['GET /user/packages']['data']
    >
  })

  // GET /user/orgs
  app.get('/user/orgs', (event: H3Event) => {
    requireAuth(event)

    const orgs = stateManager.getUserOrgs()
    return { success: true, data: orgs } satisfies ApiResponse<
      ConnectorEndpoints['GET /user/orgs']['data']
    >
  })

  // -- Test-only endpoints --

  // POST /__test__/reset
  app.post('/__test__/reset', () => {
    stateManager.reset()
    return { success: true }
  })

  // POST /__test__/org
  app.post('/__test__/org', async (event: H3Event) => {
    const body = (await event.req.json()) as {
      org?: string
      users?: Record<string, 'developer' | 'admin' | 'owner'>
      teams?: string[]
      teamMembers?: Record<string, string[]>
    }
    if (!body?.org) {
      throw new HTTPError({ statusCode: 400, message: 'Missing org parameter' })
    }

    stateManager.setOrgData(body.org, {
      users: body.users,
      teams: body.teams,
      teamMembers: body.teamMembers,
    })

    return { success: true }
  })

  // POST /__test__/user-orgs
  app.post('/__test__/user-orgs', async (event: H3Event) => {
    const body = (await event.req.json()) as { orgs?: string[] }
    if (!body?.orgs) {
      throw new HTTPError({ statusCode: 400, message: 'Missing orgs parameter' })
    }

    stateManager.setUserOrgs(body.orgs)
    return { success: true }
  })

  // POST /__test__/user-packages
  app.post('/__test__/user-packages', async (event: H3Event) => {
    const body = (await event.req.json()) as {
      packages?: Record<string, 'read-only' | 'read-write'>
    }
    if (!body?.packages) {
      throw new HTTPError({ statusCode: 400, message: 'Missing packages parameter' })
    }

    stateManager.setUserPackages(body.packages)
    return { success: true }
  })

  // POST /__test__/package
  app.post('/__test__/package', async (event: H3Event) => {
    const body = (await event.req.json()) as {
      package?: string
      collaborators?: Record<string, 'read-only' | 'read-write'>
    }
    if (!body?.package) {
      throw new HTTPError({ statusCode: 400, message: 'Missing package parameter' })
    }

    stateManager.setPackageData(body.package, {
      collaborators: body.collaborators ?? {},
    })

    return { success: true }
  })

  return app
}

/** Wraps the mock H3 app in an HTTP server via srvx. */
export class MockConnectorServer {
  private server: Server | null = null
  private stateManager: MockConnectorStateManager

  constructor(stateManager: MockConnectorStateManager) {
    this.stateManager = stateManager
  }

  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Mock connector server is already running')
    }

    const app = createMockConnectorApp(this.stateManager)

    this.server = serve({
      port: this.stateManager.port,
      hostname: '127.0.0.1',
      fetch: app.fetch,
    })

    await this.server.ready()
    console.log(`[Mock Connector] Started on http://127.0.0.1:${this.stateManager.port}`)
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await this.server.close()
    console.log('[Mock Connector] Stopped')
    this.server = null
  }

  get state(): MockConnectorStateManager {
    return this.stateManager
  }

  get port(): number {
    return this.stateManager.port
  }

  get token(): string {
    return this.stateManager.token
  }

  reset(): void {
    this.stateManager.reset()
  }
}
