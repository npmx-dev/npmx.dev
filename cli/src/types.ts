export interface ConnectorConfig {
  port: number
  host: string
}

export interface ConnectorSession {
  token: string
  connectedAt: number
  npmUser: string | null
}

export type OperationType
  = | 'org:add-user'
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

export type OperationStatus
  = | 'pending'
    | 'approved'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'

export interface PendingOperation {
  id: string
  type: OperationType
  params: Record<string, string>
  description: string
  command: string
  status: OperationStatus
  createdAt: number
  result?: {
    stdout: string
    stderr: string
    exitCode: number
  }
}

export interface ConnectorState {
  session: ConnectorSession
  operations: PendingOperation[]
  otp: string | null
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
