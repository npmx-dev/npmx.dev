import crypto from 'node:crypto'
import { H3, HTTPError, handleCors, type H3Event } from 'h3-next'
import type { CorsOptions } from 'h3-next'
import * as v from 'valibot'

import type { ConnectorState, PendingOperation, ApiResponse } from './types.ts'
import { logDebug, logError } from './logger.ts'
import {
  getNpmUser,
  getNpmAvatar,
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
  packageInit,
  listUserPackages,
  type NpmExecResult,
} from './npm-client.ts'
import {
  ConnectBodySchema,
  ExecuteBodySchema,
  CreateOperationBodySchema,
  BatchOperationsBodySchema,
  OrgNameSchema,
  ScopeTeamSchema,
  PackageNameSchema,
  OperationIdSchema,
  safeParse,
  validateOperationParams,
} from './schemas.ts'

// Read version from package.json
import pkg from '../package.json' with { type: 'json' }

export const CONNECTOR_VERSION = pkg.version

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

function generateOperationId(): string {
  return crypto.randomBytes(8).toString('hex')
}

const corsOptions: CorsOptions = {
  origin: ['https://npmx.dev', /^http:\/\/localhost:\d+$/],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}

export function createConnectorApp(expectedToken: string) {
  const state: ConnectorState = {
    session: {
      token: expectedToken,
      connectedAt: 0,
      npmUser: null,
      avatar: null,
    },
    operations: [],
  }

  const app = new H3()

  // Handle CORS for all requests (including preflight)
  app.use((event: H3Event) => {
    const corsResult = handleCors(event, corsOptions)
    if (corsResult !== false) {
      return corsResult
    }
  })

  function validateToken(authHeader: string | null): boolean {
    if (!authHeader) return false
    const token = authHeader.replace('Bearer ', '')
    return token === expectedToken
  }

  app.post('/connect', async (event: H3Event) => {
    const rawBody = await event.req.json()
    const parsed = safeParse(ConnectBodySchema, rawBody)
    if (!parsed.success) {
      throw new HTTPError({ statusCode: 400, message: parsed.error })
    }

    if (parsed.data.token !== expectedToken) {
      throw new HTTPError({ statusCode: 401, message: 'Invalid token' })
    }

    const [npmUser, avatar] = await Promise.all([getNpmUser(), getNpmAvatar()])
    state.session.connectedAt = Date.now()
    state.session.npmUser = npmUser
    state.session.avatar = avatar

    return {
      success: true,
      data: {
        npmUser,
        avatar,
        connectedAt: state.session.connectedAt,
      },
    } as ApiResponse
  })

  app.get('/state', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    return {
      success: true,
      data: {
        npmUser: state.session.npmUser,
        avatar: state.session.avatar,
        operations: state.operations,
      },
    } as ApiResponse
  })

  app.post('/operations', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const rawBody = await event.req.json()
    const parsed = safeParse(CreateOperationBodySchema, rawBody)
    if (!parsed.success) {
      throw new HTTPError({ statusCode: 400, message: parsed.error })
    }

    const { type, params, description, command } = parsed.data

    // Validate params based on operation type
    try {
      validateOperationParams(type, params)
    } catch (err) {
      const message = err instanceof v.ValiError ? err.issues[0]?.message : String(err)
      throw new HTTPError({ statusCode: 400, message: `Invalid params: ${message}` })
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
  })

  app.post('/operations/batch', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const rawBody = await event.req.json()
    const parsed = safeParse(BatchOperationsBodySchema, rawBody)
    if (!parsed.success) {
      throw new HTTPError({ statusCode: 400, message: parsed.error })
    }

    // Validate each operation's params
    for (let i = 0; i < parsed.data.length; i++) {
      const op = parsed.data[i]
      if (!op) continue
      try {
        validateOperationParams(op.type, op.params)
      } catch (err) {
        const message = err instanceof v.ValiError ? err.issues[0]?.message : String(err)
        throw new HTTPError({
          statusCode: 400,
          message: `Operation ${i}: Invalid params: ${message}`,
        })
      }
    }

    const created: PendingOperation[] = []
    for (const op of parsed.data) {
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
  })

  app.post('/approve', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const url = new URL(event.req.url)
    const id = url.searchParams.get('id')

    const idValidation = safeParse(OperationIdSchema, id)
    if (!idValidation.success) {
      throw new HTTPError({ statusCode: 400, message: idValidation.error })
    }

    const operation = state.operations.find(op => op.id === idValidation.data)
    if (!operation) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found' })
    }

    if (operation.status !== 'pending') {
      throw new HTTPError({
        statusCode: 400,
        message: 'Operation is not pending',
      })
    }

    operation.status = 'approved'

    return {
      success: true,
      data: operation,
    } as ApiResponse
  })

  app.post('/approve-all', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const pendingOps = state.operations.filter(op => op.status === 'pending')
    for (const op of pendingOps) {
      op.status = 'approved'
    }

    return {
      success: true,
      data: { approved: pendingOps.length },
    } as ApiResponse
  })

  app.post('/retry', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const url = new URL(event.req.url)
    const id = url.searchParams.get('id')

    const idValidation = safeParse(OperationIdSchema, id)
    if (!idValidation.success) {
      throw new HTTPError({ statusCode: 400, message: idValidation.error })
    }

    const operation = state.operations.find(op => op.id === idValidation.data)
    if (!operation) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found' })
    }

    if (operation.status !== 'failed') {
      throw new HTTPError({
        statusCode: 400,
        message: 'Only failed operations can be retried',
      })
    }

    // Reset the operation for retry
    operation.status = 'approved'
    operation.result = undefined

    return {
      success: true,
      data: operation,
    } as ApiResponse
  })

  app.post('/execute', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    // OTP can be passed directly in the request body for this execution
    let otp: string | undefined
    try {
      const rawBody = await event.req.json()
      if (rawBody) {
        const parsed = safeParse(ExecuteBodySchema, rawBody)
        if (!parsed.success) {
          throw new HTTPError({ statusCode: 400, message: parsed.error })
        }
        otp = parsed.data.otp
      }
    } catch (err) {
      // Re-throw HTTPError, ignore JSON parse errors (empty body is fine)
      if (err instanceof HTTPError) throw err
    }

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
          op.result = {
            stdout: '',
            stderr: 'Skipped: dependency failed',
            exitCode: 1,
          }
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
  })

  app.delete('/operations', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const url = new URL(event.req.url)
    const id = url.searchParams.get('id')

    const idValidation = safeParse(OperationIdSchema, id)
    if (!idValidation.success) {
      throw new HTTPError({ statusCode: 400, message: idValidation.error })
    }

    const index = state.operations.findIndex(op => op.id === idValidation.data)
    if (index === -1) {
      throw new HTTPError({ statusCode: 404, message: 'Operation not found' })
    }

    const operation = state.operations[index]
    if (!operation || operation.status === 'running') {
      throw new HTTPError({
        statusCode: 400,
        message: 'Cannot cancel running operation',
      })
    }

    state.operations.splice(index, 1)

    return { success: true } as ApiResponse
  })

  app.delete('/operations/all', event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const removed = state.operations.filter(op => op.status !== 'running').length
    state.operations = state.operations.filter(op => op.status === 'running')

    return {
      success: true,
      data: { removed },
    } as ApiResponse
  })

  // List endpoints (read-only data fetching)

  app.get('/org/:org/users', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const orgRaw = event.context.params?.org
    const orgValidation = safeParse(OrgNameSchema, orgRaw)
    if (!orgValidation.success) {
      throw new HTTPError({ statusCode: 400, message: orgValidation.error })
    }

    const result = await orgListUsers(orgValidation.data)
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
  })

  app.get('/org/:org/teams', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const orgRaw = event.context.params?.org
    const orgValidation = safeParse(OrgNameSchema, orgRaw)
    if (!orgValidation.success) {
      throw new HTTPError({ statusCode: 400, message: orgValidation.error })
    }

    const result = await teamListTeams(orgValidation.data)
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
  })

  app.get('/team/:scopeTeam/users', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const scopeTeamRaw = event.context.params?.scopeTeam
    if (!scopeTeamRaw) {
      throw new HTTPError({ statusCode: 400, message: 'Team name required' })
    }

    // Decode the team name (handles encoded colons like nuxt%3Adevelopers)
    const scopeTeam = decodeURIComponent(scopeTeamRaw)

    const validationResult = safeParse(ScopeTeamSchema, scopeTeam)
    if (!validationResult.success) {
      logError('scope:team validation failed')
      logDebug(validationResult.error, { scopeTeamRaw, scopeTeam })
      throw new HTTPError({
        statusCode: 400,
        message: `Invalid scope:team format: ${scopeTeam}. Expected @scope:team`,
      })
    }

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
  })

  app.get('/package/:pkg/collaborators', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const pkgRaw = event.context.params?.pkg
    if (!pkgRaw) {
      throw new HTTPError({ statusCode: 400, message: 'Package name required' })
    }

    // Decode the package name (handles scoped packages like @nuxt%2Fkit)
    const decodedPkg = decodeURIComponent(pkgRaw)

    const pkgValidation = safeParse(PackageNameSchema, decodedPkg)
    if (!pkgValidation.success) {
      throw new HTTPError({ statusCode: 400, message: pkgValidation.error })
    }

    const result = await accessListCollaborators(pkgValidation.data)
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || 'Failed to list collaborators',
      } as ApiResponse
    }

    try {
      const collaborators = JSON.parse(result.stdout) as Record<string, 'read-only' | 'read-write'>
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
  })

  // User-specific endpoints

  app.get('/user/packages', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const npmUser = state.session.npmUser
    if (!npmUser) {
      return {
        success: false,
        error: 'Not logged in to npm',
      } as ApiResponse
    }

    const result = await listUserPackages(npmUser)
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || 'Failed to list user packages',
      } as ApiResponse
    }

    try {
      // npm access list packages returns { "packageName": "read-write" | "read-only" }
      const packages = JSON.parse(result.stdout) as Record<string, 'read-write' | 'read-only'>
      return {
        success: true,
        data: packages,
      } as ApiResponse
    } catch {
      return {
        success: false,
        error: 'Failed to parse user packages',
      } as ApiResponse
    }
  })

  app.get('/user/orgs', async event => {
    const auth = event.req.headers.get('authorization')
    if (!validateToken(auth)) {
      throw new HTTPError({ statusCode: 401, message: 'Unauthorized' })
    }

    const npmUser = state.session.npmUser
    if (!npmUser) {
      return {
        success: false,
        error: 'Not logged in to npm',
      } as ApiResponse
    }

    // Get user's packages and extract org names from scoped packages
    const result = await listUserPackages(npmUser)
    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || 'Failed to list user packages',
      } as ApiResponse
    }

    try {
      const packages = JSON.parse(result.stdout) as Record<string, string>
      const orgs = new Set<string>()

      // Extract org names from scoped packages (e.g., @myorg/mypackage -> myorg)
      for (const pkgName of Object.keys(packages)) {
        if (pkgName.startsWith('@')) {
          const match = pkgName.match(/^@([^/]+)\//)
          if (match && match[1]) {
            // Exclude the user's own scope (personal packages)
            if (match[1].toLowerCase() !== npmUser.toLowerCase()) {
              orgs.add(match[1])
            }
          }
        }
      }

      return {
        success: true,
        data: Array.from(orgs).sort(),
      } as ApiResponse
    } catch {
      return {
        success: false,
        error: 'Failed to parse user orgs',
      } as ApiResponse
    }
  })

  return app
}

async function executeOperation(op: PendingOperation, otp?: string): Promise<NpmExecResult> {
  const { type, params } = op

  switch (type) {
    case 'org:add-user':
      return orgAddUser(
        params.org,
        params.user,
        params.role as 'developer' | 'admin' | 'owner',
        otp,
      )
    case 'org:rm-user':
      return orgRemoveUser(params.org, params.user, otp)
    case 'team:create':
      return teamCreate(params.scopeTeam, otp)
    case 'team:destroy':
      return teamDestroy(params.scopeTeam, otp)
    case 'team:add-user':
      return teamAddUser(params.scopeTeam, params.user, otp)
    case 'team:rm-user':
      return teamRemoveUser(params.scopeTeam, params.user, otp)
    case 'access:grant':
      return accessGrant(
        params.permission as 'read-only' | 'read-write',
        params.scopeTeam,
        params.pkg,
        otp,
      )
    case 'access:revoke':
      return accessRevoke(params.scopeTeam, params.pkg, otp)
    case 'owner:add':
      return ownerAdd(params.user, params.pkg, otp)
    case 'owner:rm':
      return ownerRemove(params.user, params.pkg, otp)
    case 'package:init':
      return packageInit(params.name, params.author, otp)
    default:
      return {
        stdout: '',
        stderr: `Unknown operation type: ${type}`,
        exitCode: 1,
      }
  }
}

export { generateToken }
