/**
 * Mock connector state management. Canonical source used by the mock server,
 * E2E tests, and Vitest composable mocks.
 */

import type {
  PendingOperation,
  OperationType,
  OperationResult,
  OrgRole,
  AccessPermission,
} from './types.ts'

export interface MockConnectorConfig {
  token: string
  npmUser: string
  avatar?: string | null
  port?: number
}

export interface MockOrgData {
  users: Record<string, OrgRole>
  teams: string[]
  /** team name -> member usernames */
  teamMembers: Record<string, string[]>
}

export interface MockPackageData {
  collaborators: Record<string, AccessPermission>
}

export interface MockConnectorStateData {
  config: MockConnectorConfig
  connected: boolean
  connectedAt: number | null
  orgs: Record<string, MockOrgData>
  packages: Record<string, MockPackageData>
  userPackages: Record<string, AccessPermission>
  userOrgs: string[]
  operations: PendingOperation[]
  operationIdCounter: number
}

export interface NewOperationInput {
  type: OperationType
  params: Record<string, string>
  description: string
  command: string
  dependsOn?: string
}

export interface ExecuteOptions {
  otp?: string
  /** Per-operation results for testing failures. */
  results?: Record<string, Partial<OperationResult>>
}

export interface ExecuteResult {
  results: Array<{ id: string; result: OperationResult }>
  otpRequired?: boolean
  authFailure?: boolean
  urls?: string[]
}

export function createMockConnectorState(config: MockConnectorConfig): MockConnectorStateData {
  return {
    config: {
      port: 31415,
      avatar: null,
      ...config,
    },
    connected: false,
    connectedAt: null,
    orgs: {},
    packages: {},
    userPackages: {},
    userOrgs: [],
    operations: [],
    operationIdCounter: 0,
  }
}

/**
 * Mock connector state, shared between the HTTP server and composable mock.
 */
export class MockConnectorStateManager {
  public state: MockConnectorStateData

  constructor(initialState: MockConnectorStateData) {
    this.state = initialState
  }

  // -- Configuration --

  get config(): MockConnectorConfig {
    return this.state.config
  }

  get token(): string {
    return this.state.config.token
  }

  get port(): number {
    return this.state.config.port ?? 31415
  }

  // -- Connection --

  connect(token: string): boolean {
    if (token !== this.state.config.token) {
      return false
    }
    this.state.connected = true
    this.state.connectedAt = Date.now()
    return true
  }

  disconnect(): void {
    this.state.connected = false
    this.state.connectedAt = null
    this.state.operations = []
  }

  isConnected(): boolean {
    return this.state.connected
  }

  // -- Org data --

  setOrgData(org: string, data: Partial<MockOrgData>): void {
    const existing = this.state.orgs[org] ?? { users: {}, teams: [], teamMembers: {} }
    this.state.orgs[org] = {
      users: { ...existing.users, ...data.users },
      teams: data.teams ?? existing.teams,
      teamMembers: { ...existing.teamMembers, ...data.teamMembers },
    }
  }

  getOrgUsers(org: string): Record<string, OrgRole> | null {
    const normalizedOrg = org.startsWith('@') ? org : `@${org}`
    return this.state.orgs[normalizedOrg]?.users ?? null
  }

  getOrgTeams(org: string): string[] | null {
    const normalizedOrg = org.startsWith('@') ? org : `@${org}`
    return this.state.orgs[normalizedOrg]?.teams ?? null
  }

  getTeamUsers(scope: string, team: string): string[] | null {
    const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`
    const org = this.state.orgs[normalizedScope]
    if (!org) return null
    return org.teamMembers[team] ?? null
  }

  // -- Package data --

  setPackageData(pkg: string, data: MockPackageData): void {
    this.state.packages[pkg] = data
  }

  getPackageCollaborators(pkg: string): Record<string, AccessPermission> | null {
    return this.state.packages[pkg]?.collaborators ?? null
  }

  // -- User data --

  setUserPackages(packages: Record<string, AccessPermission>): void {
    this.state.userPackages = packages
  }

  setUserOrgs(orgs: string[]): void {
    this.state.userOrgs = orgs
  }

  getUserPackages(): Record<string, AccessPermission> {
    return this.state.userPackages
  }

  getUserOrgs(): string[] {
    return this.state.userOrgs
  }

  // -- Operations queue --

  addOperation(operation: NewOperationInput): PendingOperation {
    const id = `op-${++this.state.operationIdCounter}`
    const newOp: PendingOperation = {
      id,
      type: operation.type,
      params: operation.params,
      description: operation.description,
      command: operation.command,
      status: 'pending',
      createdAt: Date.now(),
      dependsOn: operation.dependsOn,
    }
    this.state.operations.push(newOp)
    return newOp
  }

  addOperations(operations: NewOperationInput[]): PendingOperation[] {
    return operations.map(op => this.addOperation(op))
  }

  getOperation(id: string): PendingOperation | undefined {
    return this.state.operations.find(op => op.id === id)
  }

  getOperations(): PendingOperation[] {
    return this.state.operations
  }

  removeOperation(id: string): boolean {
    const index = this.state.operations.findIndex(op => op.id === id)
    if (index === -1) return false
    const op = this.state.operations[index]
    // Can't remove running operations
    if (op?.status === 'running') return false
    this.state.operations.splice(index, 1)
    return true
  }

  clearOperations(): number {
    const removable = this.state.operations.filter(op => op.status !== 'running')
    const count = removable.length
    this.state.operations = this.state.operations.filter(op => op.status === 'running')
    return count
  }

  approveOperation(id: string): PendingOperation | null {
    const op = this.state.operations.find(op => op.id === id)
    if (!op || op.status !== 'pending') return null
    op.status = 'approved'
    return op
  }

  approveAll(): number {
    let count = 0
    for (const op of this.state.operations) {
      if (op.status === 'pending') {
        op.status = 'approved'
        count++
      }
    }
    return count
  }

  retryOperation(id: string): PendingOperation | null {
    const op = this.state.operations.find(op => op.id === id)
    if (!op || op.status !== 'failed') return null
    op.status = 'approved'
    op.result = undefined
    return op
  }

  /** Execute all approved operations (mock: instant success unless configured otherwise). */
  executeOperations(options?: ExecuteOptions): ExecuteResult {
    const results: Array<{ id: string; result: OperationResult }> = []
    const approved = this.state.operations.filter(op => op.status === 'approved')

    // Sort by dependencies
    const sorted = this.sortByDependencies(approved)

    for (const op of sorted) {
      // Check if dependent operation completed successfully
      if (op.dependsOn) {
        const dep = this.state.operations.find(d => d.id === op.dependsOn)
        if (!dep || dep.status !== 'completed') {
          // Skip - dependency not met
          continue
        }
      }

      op.status = 'running'

      // Check for configured result
      const configuredResult = options?.results?.[op.id]
      if (configuredResult) {
        const result: OperationResult = {
          stdout: configuredResult.stdout ?? '',
          stderr: configuredResult.stderr ?? '',
          exitCode: configuredResult.exitCode ?? 1,
          requiresOtp: configuredResult.requiresOtp,
          authFailure: configuredResult.authFailure,
          urls: configuredResult.urls,
        }
        op.result = result
        op.status = result.exitCode === 0 ? 'completed' : 'failed'
        results.push({ id: op.id, result })

        if (result.requiresOtp && !options?.otp) {
          return { results, otpRequired: true }
        }
      } else {
        // Default: success
        const result: OperationResult = {
          stdout: `Mock: ${op.command}`,
          stderr: '',
          exitCode: 0,
        }
        op.result = result
        op.status = 'completed'
        results.push({ id: op.id, result })

        // Apply the operation's effects to mock state
        this.applyOperationEffect(op)
      }
    }

    const authFailure = results.some(r => r.result.authFailure)
    const allUrls = results.flatMap(r => r.result.urls ?? [])
    const urls = [...new Set(allUrls)]

    return {
      results,
      authFailure: authFailure || undefined,
      urls: urls.length > 0 ? urls : undefined,
    }
  }

  /** Apply side effects of a completed operation. Param keys match schemas.ts. */
  private applyOperationEffect(op: PendingOperation): void {
    const { type, params } = op

    switch (type) {
      case 'org:add-user': {
        // Params: { org, user, role } — OrgAddUserParamsSchema
        const org = params['org']
        const user = params['user']
        const role = (params['role'] as OrgRole) ?? 'developer'
        if (org && user) {
          const normalizedOrg = org.startsWith('@') ? org : `@${org}`
          if (!this.state.orgs[normalizedOrg]) {
            this.state.orgs[normalizedOrg] = { users: {}, teams: [], teamMembers: {} }
          }
          this.state.orgs[normalizedOrg].users[user] = role
        }
        break
      }
      case 'org:rm-user': {
        // Params: { org, user } — OrgRemoveUserParamsSchema
        const org = params['org']
        const user = params['user']
        if (org && user) {
          const normalizedOrg = org.startsWith('@') ? org : `@${org}`
          if (this.state.orgs[normalizedOrg]) {
            delete this.state.orgs[normalizedOrg].users[user]
          }
        }
        break
      }
      case 'org:set-role': {
        // Params: { org, user, role } — reuses OrgAddUserParamsSchema
        const org = params['org']
        const user = params['user']
        const role = params['role'] as OrgRole
        if (org && user && role) {
          const normalizedOrg = org.startsWith('@') ? org : `@${org}`
          if (this.state.orgs[normalizedOrg]) {
            this.state.orgs[normalizedOrg].users[user] = role
          }
        }
        break
      }
      case 'team:create': {
        // Params: { scopeTeam } — TeamCreateParamsSchema
        const scopeTeam = params['scopeTeam']
        if (scopeTeam) {
          const [scope, team] = scopeTeam.split(':')
          if (scope && team) {
            const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`
            if (!this.state.orgs[normalizedScope]) {
              this.state.orgs[normalizedScope] = { users: {}, teams: [], teamMembers: {} }
            }
            if (!this.state.orgs[normalizedScope].teams.includes(team)) {
              this.state.orgs[normalizedScope].teams.push(team)
            }
            this.state.orgs[normalizedScope].teamMembers[team] = []
          }
        }
        break
      }
      case 'team:destroy': {
        // Params: { scopeTeam } — TeamDestroyParamsSchema
        const scopeTeam = params['scopeTeam']
        if (scopeTeam) {
          const [scope, team] = scopeTeam.split(':')
          if (scope && team) {
            const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`
            if (this.state.orgs[normalizedScope]) {
              this.state.orgs[normalizedScope].teams = this.state.orgs[
                normalizedScope
              ].teams.filter(t => t !== team)
              delete this.state.orgs[normalizedScope].teamMembers[team]
            }
          }
        }
        break
      }
      case 'team:add-user': {
        // Params: { scopeTeam, user } — TeamAddUserParamsSchema
        const scopeTeam = params['scopeTeam']
        const user = params['user']
        if (scopeTeam && user) {
          const [scope, team] = scopeTeam.split(':')
          if (scope && team) {
            const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`
            if (this.state.orgs[normalizedScope]) {
              const members = this.state.orgs[normalizedScope].teamMembers[team] ?? []
              if (!members.includes(user)) {
                members.push(user)
              }
              this.state.orgs[normalizedScope].teamMembers[team] = members
            }
          }
        }
        break
      }
      case 'team:rm-user': {
        // Params: { scopeTeam, user } — TeamRemoveUserParamsSchema
        const scopeTeam = params['scopeTeam']
        const user = params['user']
        if (scopeTeam && user) {
          const [scope, team] = scopeTeam.split(':')
          if (scope && team) {
            const normalizedScope = scope.startsWith('@') ? scope : `@${scope}`
            if (this.state.orgs[normalizedScope]) {
              const members = this.state.orgs[normalizedScope].teamMembers[team]
              if (members) {
                this.state.orgs[normalizedScope].teamMembers[team] = members.filter(u => u !== user)
              }
            }
          }
        }
        break
      }
      case 'access:grant': {
        // Params: { permission, scopeTeam, pkg } — AccessGrantParamsSchema
        const pkg = params['pkg']
        const scopeTeam = params['scopeTeam']
        const permission = (params['permission'] as AccessPermission) ?? 'read-write'
        if (pkg && scopeTeam) {
          if (!this.state.packages[pkg]) {
            this.state.packages[pkg] = { collaborators: {} }
          }
          this.state.packages[pkg].collaborators[scopeTeam] = permission
        }
        break
      }
      case 'access:revoke': {
        // Params: { scopeTeam, pkg } — AccessRevokeParamsSchema
        const pkg = params['pkg']
        const scopeTeam = params['scopeTeam']
        if (pkg && scopeTeam && this.state.packages[pkg]) {
          delete this.state.packages[pkg].collaborators[scopeTeam]
        }
        break
      }
      case 'owner:add': {
        // Params: { user, pkg } — OwnerAddParamsSchema
        const pkg = params['pkg']
        const user = params['user']
        if (pkg && user) {
          if (!this.state.packages[pkg]) {
            this.state.packages[pkg] = { collaborators: {} }
          }
          this.state.packages[pkg].collaborators[user] = 'read-write'
        }
        break
      }
      case 'owner:rm': {
        // Params: { user, pkg } — OwnerRemoveParamsSchema
        const pkg = params['pkg']
        const user = params['user']
        if (pkg && user && this.state.packages[pkg]) {
          delete this.state.packages[pkg].collaborators[user]
        }
        break
      }
      case 'package:init': {
        // Params: { name, author? } — PackageInitParamsSchema
        const name = params['name']
        if (name) {
          this.state.packages[name] = {
            collaborators: { [this.state.config.npmUser]: 'read-write' },
          }
          this.state.userPackages[name] = 'read-write'
        }
        break
      }
    }
  }

  /** Topological sort by dependsOn. */
  private sortByDependencies(operations: PendingOperation[]): PendingOperation[] {
    const result: PendingOperation[] = []
    const visited = new Set<string>()

    const visit = (op: PendingOperation) => {
      if (visited.has(op.id)) return
      visited.add(op.id)

      if (op.dependsOn) {
        const dep = operations.find(d => d.id === op.dependsOn)
        if (dep) visit(dep)
      }

      result.push(op)
    }

    for (const op of operations) {
      visit(op)
    }

    return result
  }

  reset(): void {
    this.state.connected = false
    this.state.connectedAt = null
    this.state.orgs = {}
    this.state.packages = {}
    this.state.userPackages = {}
    this.state.userOrgs = []
    this.state.operations = []
    this.state.operationIdCounter = 0
  }
}

/** @internal */
export const DEFAULT_MOCK_CONFIG: MockConnectorConfig = {
  token: 'test-token-e2e-12345',
  npmUser: 'testuser',
  avatar: null,
  port: 31415,
}
