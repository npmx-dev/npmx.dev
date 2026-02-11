export interface ConnectorConfig {
  port: number
  host: string
}

export interface ConnectorSession {
  token: string
  connectedAt: number
  npmUser: string | null
  /** Base64 data URL of the user's avatar */
  avatar: string | null
}

export type OperationType =
  | 'org:add-user'
  | 'org:rm-user'
  | 'org:set-role'
  | 'team:create'
  | 'team:destroy'
  | 'team:add-user'
  | 'team:rm-user'
  | 'access:grant'
  | 'access:revoke'
  | 'owner:add'
  | 'owner:rm'
  | 'package:init'

export type OperationStatus =
  | 'pending'
  | 'approved'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface OperationResult {
  stdout: string
  stderr: string
  exitCode: number
  /** True if the operation failed due to missing/invalid OTP */
  requiresOtp?: boolean
  /** True if the operation failed due to authentication failure (not logged in or token expired) */
  authFailure?: boolean
}

export interface PendingOperation {
  id: string
  type: OperationType
  params: Record<string, string>
  description: string
  command: string
  status: OperationStatus
  createdAt: number
  result?: OperationResult
  /** ID of operation this depends on (must complete successfully first) */
  dependsOn?: string
}

export interface ConnectorState {
  session: ConnectorSession
  operations: PendingOperation[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// -- Connector API contract (shared by real + mock server) -------------------

export type OrgRole = 'developer' | 'admin' | 'owner'

export type AccessPermission = 'read-only' | 'read-write'

/** POST /connect response data */
export interface ConnectResponseData {
  npmUser: string | null
  avatar: string | null
  connectedAt: number
}

/** GET /state response data */
export interface StateResponseData {
  npmUser: string | null
  avatar: string | null
  operations: PendingOperation[]
}

/** POST /execute response data */
export interface ExecuteResponseData {
  results: Array<{ id: string; result: OperationResult }>
  otpRequired?: boolean
  authFailure?: boolean
}

/** POST /approve-all response data */
export interface ApproveAllResponseData {
  approved: number
}

/** DELETE /operations/all response data */
export interface ClearOperationsResponseData {
  removed: number
}

/** Request body for POST /operations */
export interface CreateOperationBody {
  type: OperationType
  params: Record<string, string>
  description: string
  command: string
  dependsOn?: string
}

/**
 * Connector API endpoint contract. Both server.ts and mock-app.ts must
 * conform to these shapes, enforced via `satisfies` and `AssertEndpointsImplemented`.
 */
export interface ConnectorEndpoints {
  'POST /connect': { body: { token: string }; data: ConnectResponseData }
  'GET /state': { body: never; data: StateResponseData }
  'POST /operations': { body: CreateOperationBody; data: PendingOperation }
  'POST /operations/batch': { body: CreateOperationBody[]; data: PendingOperation[] }
  'DELETE /operations': { body: never; data: void }
  'DELETE /operations/all': { body: never; data: ClearOperationsResponseData }
  'POST /approve': { body: never; data: PendingOperation }
  'POST /approve-all': { body: never; data: ApproveAllResponseData }
  'POST /retry': { body: never; data: PendingOperation }
  'POST /execute': { body: { otp?: string }; data: ExecuteResponseData }
  'GET /org/:org/users': { body: never; data: Record<string, OrgRole> }
  'GET /org/:org/teams': { body: never; data: string[] }
  'GET /team/:scopeTeam/users': { body: never; data: string[] }
  'GET /package/:pkg/collaborators': { body: never; data: Record<string, AccessPermission> }
  'GET /user/packages': { body: never; data: Record<string, AccessPermission> }
  'GET /user/orgs': { body: never; data: string[] }
}

/** Compile-time check that a server implements exactly the ConnectorEndpoints keys. */
type IsExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
export type AssertEndpointsImplemented<Implemented extends string> =
  IsExact<Implemented, keyof ConnectorEndpoints> extends true
    ? true
    : {
        error: 'Endpoint mismatch'
        missing: Exclude<keyof ConnectorEndpoints, Implemented>
        extra: Exclude<Implemented, keyof ConnectorEndpoints>
      }
