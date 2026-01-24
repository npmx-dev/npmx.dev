import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  createApp,
  createRouter,
  eventHandler,
  readBody,
  getQuery,
  createError,
  getHeader,
  getRequestHeader,
  setResponseHeaders,
  getRouterParam,
} from 'h3'

const ALLOWED_ORIGINS = new Set(['https://npmx.dev', 'http://localhost:3000'])
import type { ConnectorState, PendingOperation, OperationType, ApiResponse } from './types.ts'
import {
  getNpmUser,
  orgAddUser,
  orgRemoveUser,
  orgListUsers,
  teamCreate,
  teamDestroy,
  teamAddUser,
  teamRemoveUser,
  teamListTeams,
  teamListUsers,
  accessGrant,
  accessRevoke,
  accessListCollaborators,
  ownerAdd,
  ownerRemove,
  type NpmExecResult,
} from './npm-client.ts'

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url))
function getConnectorVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    // Fallback if package.json can't be read (e.g., in bundled builds)
    return '0.0.0'
  }
}

export const CONNECTOR_VERSION = getConnectorVersion()

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateOperationId(): string {
  return crypto.randomBytes(8).toString('hex')
}

export function createConnectorApp(expectedToken: string) {
  const state: ConnectorState = {
    session: {
      token: expectedToken,
      connectedAt: 0,
      npmUser: null,
    },
    operations: [],
  }

  function setCorsHeaders(event: Parameters<typeof setResponseHeaders>[0]) {
    const origin = getRequestHeader(event, 'origin')
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      setResponseHeaders(event, {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
    }
  }

  const app = createApp({
    onRequest(event) {
      setCorsHeaders(event)
    },
    onBeforeResponse(event) {
      setCorsHeaders(event)
    },
  })
  const router = createRouter()

  // Handle CORS preflight requests
  router.options(
    '/**',
    eventHandler(() => ''),
  )

  function validateToken(authHeader: string | null | undefined): boolean {
    if (!authHeader) return false
    const token = authHeader.replace('Bearer ', '')
    return token === expectedToken
  }

  router.post(
    '/connect',
    eventHandler(async event => {
      const body = await readBody(event)
      if (body?.token !== expectedToken) {
        throw createError({ statusCode: 401, message: 'Invalid token' })
      }

      const npmUser = await getNpmUser()
      state.session.connectedAt = Date.now()
      state.session.npmUser = npmUser

      return {
        success: true,
        data: {
          npmUser,
          connectedAt: state.session.connectedAt,
        },
      } as ApiResponse
    }),
  )

  router.get(
    '/state',
    eventHandler(event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      return {
        success: true,
        data: {
          npmUser: state.session.npmUser,
          operations: state.operations,
        },
      } as ApiResponse
    }),
  )

  router.post(
    '/operations',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const body = await readBody(event)
      const { type, params, description, command } = body as {
        type: OperationType
        params: Record<string, string>
        description: string
        command: string
      }

      const operation: PendingOperation = {
        id: generateOperationId(),
        type,
        params,
        description,
        command,
        status: 'pending',
        createdAt: Date.now(),
      }

      state.operations.push(operation)

      return {
        success: true,
        data: operation,
      } as ApiResponse
    }),
  )

  router.post(
    '/operations/batch',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const body = await readBody(event)
      const operations = body as Array<{
        type: OperationType
        params: Record<string, string>
        description: string
        command: string
      }>

      const created: PendingOperation[] = []
      for (const op of operations) {
        const operation: PendingOperation = {
          id: generateOperationId(),
          type: op.type,
          params: op.params,
          description: op.description,
          command: op.command,
          status: 'pending',
          createdAt: Date.now(),
        }
        state.operations.push(operation)
        created.push(operation)
      }

      return {
        success: true,
        data: created,
      } as ApiResponse
    }),
  )

  router.post(
    '/approve',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const query = getQuery(event)
      const id = query.id as string

      const operation = state.operations.find(op => op.id === id)
      if (!operation) {
        throw createError({ statusCode: 404, message: 'Operation not found' })
      }

      if (operation.status !== 'pending') {
        throw createError({ statusCode: 400, message: 'Operation is not pending' })
      }

      operation.status = 'approved'

      return {
        success: true,
        data: operation,
      } as ApiResponse
    }),
  )

  router.post(
    '/approve-all',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const pendingOps = state.operations.filter(op => op.status === 'pending')
      for (const op of pendingOps) {
        op.status = 'approved'
      }

      return {
        success: true,
        data: { approved: pendingOps.length },
      } as ApiResponse
    }),
  )

  router.post(
    '/retry',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const query = getQuery(event)
      const id = query.id as string

      const operation = state.operations.find(op => op.id === id)
      if (!operation) {
        throw createError({ statusCode: 404, message: 'Operation not found' })
      }

      if (operation.status !== 'failed') {
        throw createError({ statusCode: 400, message: 'Only failed operations can be retried' })
      }

      // Reset the operation for retry
      operation.status = 'approved'
      operation.result = undefined

      return {
        success: true,
        data: operation,
      } as ApiResponse
    }),
  )

  router.post(
    '/execute',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      // OTP can be passed directly in the request body for this execution
      const body = await readBody(event)
      const otp = body?.otp as string | undefined

      const approvedOps = state.operations.filter(op => op.status === 'approved')
      const results: Array<{ id: string; result: NpmExecResult }> = []
      let otpRequired = false
      const completedIds = new Set<string>()
      const failedIds = new Set<string>()

      // Execute operations in waves, respecting dependencies
      // Each wave contains operations whose dependencies are satisfied
      while (true) {
        // Find operations ready to run (no pending dependencies)
        const readyOps = approvedOps.filter(op => {
          // Already processed
          if (completedIds.has(op.id) || failedIds.has(op.id)) return false
          // No dependency - ready
          if (!op.dependsOn) return true
          // Dependency completed successfully - ready
          if (completedIds.has(op.dependsOn)) return true
          // Dependency failed - skip this one too
          if (failedIds.has(op.dependsOn)) {
            op.status = 'failed'
            op.result = { stdout: '', stderr: 'Skipped: dependency failed', exitCode: 1 }
            failedIds.add(op.id)
            results.push({ id: op.id, result: op.result })
            return false
          }
          // Dependency still pending - not ready
          return false
        })

        // No more operations to run
        if (readyOps.length === 0) break

        // If we've hit an OTP error and no OTP was provided, stop
        if (otpRequired && !otp) break

        // Execute ready operations in parallel
        const runningOps = readyOps.map(async op => {
          op.status = 'running'
          const result = await executeOperation(op, otp)
          op.result = result
          op.status = result.exitCode === 0 ? 'completed' : 'failed'

          if (result.exitCode === 0) {
            completedIds.add(op.id)
          } else {
            failedIds.add(op.id)
          }

          // Track if OTP is needed
          if (result.requiresOtp) {
            otpRequired = true
          }

          results.push({ id: op.id, result })
        })

        await Promise.all(runningOps)
      }

      // Check if any operation had an auth failure
      const authFailure = results.some(r => r.result.authFailure)

      return {
        success: true,
        data: {
          results,
          otpRequired,
          authFailure,
        },
      } as ApiResponse
    }),
  )

  router.delete(
    '/operations',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const query = getQuery(event)
      const id = query.id as string

      const index = state.operations.findIndex(op => op.id === id)
      if (index === -1) {
        throw createError({ statusCode: 404, message: 'Operation not found' })
      }

      const operation = state.operations[index]
      if (!operation || operation.status === 'running') {
        throw createError({ statusCode: 400, message: 'Cannot cancel running operation' })
      }

      state.operations.splice(index, 1)

      return { success: true } as ApiResponse
    }),
  )

  router.delete(
    '/operations/all',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const removed = state.operations.filter(op => op.status !== 'running').length
      state.operations = state.operations.filter(op => op.status === 'running')

      return {
        success: true,
        data: { removed },
      } as ApiResponse
    }),
  )

  // List endpoints (read-only data fetching)

  router.get(
    '/org/:org/users',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const org = getRouterParam(event, 'org')
      if (!org) {
        throw createError({ statusCode: 400, message: 'Org name required' })
      }

      const result = await orgListUsers(org)
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to list org users',
        } as ApiResponse
      }

      try {
        const users = JSON.parse(result.stdout) as Record<string, 'developer' | 'admin' | 'owner'>
        return {
          success: true,
          data: users,
        } as ApiResponse
      } catch {
        return {
          success: false,
          error: 'Failed to parse org users',
        } as ApiResponse
      }
    }),
  )

  router.get(
    '/org/:org/teams',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const org = getRouterParam(event, 'org')
      if (!org) {
        throw createError({ statusCode: 400, message: 'Org name required' })
      }

      const result = await teamListTeams(org)
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to list teams',
        } as ApiResponse
      }

      try {
        const teams = JSON.parse(result.stdout) as string[]
        return {
          success: true,
          data: teams,
        } as ApiResponse
      } catch {
        return {
          success: false,
          error: 'Failed to parse teams',
        } as ApiResponse
      }
    }),
  )

  router.get(
    '/team/:scopeTeam/users',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const scopeTeamRaw = getRouterParam(event, 'scopeTeam')
      if (!scopeTeamRaw) {
        throw createError({ statusCode: 400, message: 'Team name required' })
      }

      // Decode the team name (handles encoded colons like nuxt%3Adevelopers)
      const scopeTeam = decodeURIComponent(scopeTeamRaw)

      const result = await teamListUsers(scopeTeam)
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to list team users',
        } as ApiResponse
      }

      try {
        const users = JSON.parse(result.stdout) as string[]
        return {
          success: true,
          data: users,
        } as ApiResponse
      } catch {
        return {
          success: false,
          error: 'Failed to parse team users',
        } as ApiResponse
      }
    }),
  )

  router.get(
    '/package/:pkg/collaborators',
    eventHandler(async event => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const pkg = getRouterParam(event, 'pkg')
      if (!pkg) {
        throw createError({ statusCode: 400, message: 'Package name required' })
      }

      // Decode the package name (handles scoped packages like @nuxt%2Fkit)
      const decodedPkg = decodeURIComponent(pkg)

      const result = await accessListCollaborators(decodedPkg)
      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || 'Failed to list collaborators',
        } as ApiResponse
      }

      try {
        const collaborators = JSON.parse(result.stdout) as Record<
          string,
          'read-only' | 'read-write'
        >
        return {
          success: true,
          data: collaborators,
        } as ApiResponse
      } catch {
        return {
          success: false,
          error: 'Failed to parse collaborators',
        } as ApiResponse
      }
    }),
  )

  app.use(router)
  return app
}

async function executeOperation(op: PendingOperation, otp?: string): Promise<NpmExecResult> {
  const { type, params } = op

  switch (type) {
    case 'org:add-user':
      return orgAddUser(
        params.org!,
        params.user!,
        params.role as 'developer' | 'admin' | 'owner',
        otp,
      )
    case 'org:rm-user':
      return orgRemoveUser(params.org!, params.user!, otp)
    case 'team:create':
      return teamCreate(params.scopeTeam!, otp)
    case 'team:destroy':
      return teamDestroy(params.scopeTeam!, otp)
    case 'team:add-user':
      return teamAddUser(params.scopeTeam!, params.user!, otp)
    case 'team:rm-user':
      return teamRemoveUser(params.scopeTeam!, params.user!, otp)
    case 'access:grant':
      return accessGrant(
        params.permission as 'read-only' | 'read-write',
        params.scopeTeam!,
        params.pkg!,
        otp,
      )
    case 'access:revoke':
      return accessRevoke(params.scopeTeam!, params.pkg!, otp)
    case 'owner:add':
      return ownerAdd(params.user!, params.pkg!, otp)
    case 'owner:rm':
      return ownerRemove(params.user!, params.pkg!, otp)
    default:
      return {
        stdout: '',
        stderr: `Unknown operation type: ${type}`,
        exitCode: 1,
      }
  }
}

export { generateToken }
