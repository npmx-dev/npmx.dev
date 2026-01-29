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
