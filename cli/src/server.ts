import crypto from 'node:crypto'
import { createApp, createRouter, eventHandler, readBody, getQuery, createError, getHeader } from 'h3'
import type {
  ConnectorState,
  PendingOperation,
  OperationType,
  ApiResponse,
} from './types'
import {
  getNpmUser,
  orgAddUser,
  orgRemoveUser,
  teamCreate,
  teamDestroy,
  teamAddUser,
  teamRemoveUser,
  accessGrant,
  accessRevoke,
  ownerAdd,
  ownerRemove,
  type NpmExecResult,
} from './npm-client'

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
    otp: null,
  }

  const app = createApp()
  const router = createRouter()

  function validateToken(authHeader: string | null | undefined): boolean {
    if (!authHeader) return false
    const token = authHeader.replace('Bearer ', '')
    return token === expectedToken
  }

  router.post(
    '/connect',
    eventHandler(async (event) => {
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
    eventHandler((event) => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      return {
        success: true,
        data: {
          npmUser: state.session.npmUser,
          operations: state.operations,
          hasOtp: !!state.otp,
        },
      } as ApiResponse
    }),
  )

  router.post(
    '/operations',
    eventHandler(async (event) => {
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
    eventHandler(async (event) => {
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
    '/otp',
    eventHandler(async (event) => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const body = await readBody(event)
      state.otp = body?.otp ?? null

      return { success: true } as ApiResponse
    }),
  )

  router.post(
    '/approve',
    eventHandler(async (event) => {
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
    eventHandler(async (event) => {
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
    '/execute',
    eventHandler(async (event) => {
      const auth = getHeader(event, 'authorization')
      if (!validateToken(auth)) {
        throw createError({ statusCode: 401, message: 'Unauthorized' })
      }

      const approvedOps = state.operations.filter(op => op.status === 'approved')
      const results: Array<{ id: string, result: NpmExecResult }> = []

      for (const op of approvedOps) {
        op.status = 'running'

        const result = await executeOperation(op, state.otp ?? undefined)
        op.result = result
        op.status = result.exitCode === 0 ? 'completed' : 'failed'

        results.push({ id: op.id, result })
      }

      return {
        success: true,
        data: results,
      } as ApiResponse
    }),
  )

  router.delete(
    '/operations',
    eventHandler(async (event) => {
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
    eventHandler(async (event) => {
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

  app.use(router)
  return app
}

async function executeOperation(
  op: PendingOperation,
  otp?: string,
): Promise<NpmExecResult> {
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
