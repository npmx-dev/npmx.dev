import type { PendingOperation, OperationStatus, OperationType } from '../../cli/src/types'
import { $fetch } from 'ofetch'

export interface NewOperation {
  type: OperationType
  params: Record<string, string>
  description: string
  command: string
  /** ID of operation this depends on (must complete successfully first) */
  dependsOn?: string
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ConnectorState {
  /** Whether we're currently connected to the local connector */
  connected: boolean
  /** Whether we're attempting to connect */
  connecting: boolean
  /** The npm username if connected and authenticated */
  npmUser: string | null
  /** Base64 data URL of the user's avatar */
  avatar: string | null
  /** Pending operations queue */
  operations: PendingOperation[]
  /** Last connection error message */
  error: string | null
  /** Timestamp of last completed execution (for triggering data refreshes) */
  lastExecutionTime: number | null
}

interface ConnectResponse {
  success: boolean
  data?: {
    npmUser: string | null
    avatar: string | null
    connectedAt: number
  }
  error?: string
}

interface StateResponse {
  success: boolean
  data?: {
    npmUser: string | null
    avatar: string | null
    operations: PendingOperation[]
  }
  error?: string
}

const STORAGE_KEY = 'npmx-connector'
const DEFAULT_PORT = 31415

export const useConnector = createSharedComposable(function useConnector() {
  // Persisted connection config
  const config = useState<{ token: string; port: number } | null>('connector-config', () => null)

  // Connection state
  const state = useState<ConnectorState>('connector-state', () => ({
    connected: false,
    connecting: false,
    npmUser: null,
    avatar: null,
    operations: [],
    error: null,
    lastExecutionTime: null,
  }))

  const baseUrl = computed(() => `http://127.0.0.1:${config.value?.port ?? DEFAULT_PORT}`)

  const route = useRoute()
  const router = useRouter()

  onMounted(() => {
    const urlToken = route.query.token as string | undefined
    const urlPort = route.query.port as string | undefined

    if (urlToken) {
      const { token: _, port: __, ...cleanQuery } = route.query
      router.replace({ query: cleanQuery })

      // Connect with URL params
      const port = urlPort ? Number.parseInt(urlPort, 10) : DEFAULT_PORT
      connect(urlToken, port)
      return
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        config.value = JSON.parse(stored)
        // Auto-reconnect if we have stored credentials
        if (config.value) {
          reconnect()
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  })

  async function connect(token: string, port: number = DEFAULT_PORT): Promise<boolean> {
    state.value.connecting = true
    state.value.error = null

    try {
      const response = await $fetch<ConnectResponse>(`http://127.0.0.1:${port}/connect`, {
        method: 'POST',
        body: { token },
        timeout: 5000,
      })

      if (response.success && response.data) {
        config.value = { token, port }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))

        state.value.connected = true
        state.value.npmUser = response.data.npmUser
        state.value.avatar = response.data.avatar
        state.value.error = null

        // Fetch full state after connecting
        await refreshState()
        return true
      } else {
        state.value.error = response.error ?? 'Connection failed'
        return false
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      if (
        message.includes('fetch') ||
        message.includes('network') ||
        message.includes('ECONNREFUSED')
      ) {
        state.value.error = 'Could not reach connector. Is it running?'
      } else if (message.includes('401') || message.includes('Unauthorized')) {
        state.value.error = 'Invalid token'
      } else {
        state.value.error = message
      }
      return false
    } finally {
      state.value.connecting = false
    }
  }

  async function reconnect(): Promise<boolean> {
    if (!config.value) return false
    return connect(config.value.token, config.value.port)
  }

  function disconnect() {
    config.value = null
    localStorage.removeItem(STORAGE_KEY)
    state.value = {
      connected: false,
      connecting: false,
      npmUser: null,
      avatar: null,
      operations: [],
      error: null,
      lastExecutionTime: null,
    }
  }

  async function refreshState(): Promise<void> {
    if (!config.value) return

    try {
      const response = await $fetch<StateResponse>(`${baseUrl.value}/state`, {
        headers: {
          Authorization: `Bearer ${config.value.token}`,
        },
        timeout: 5000,
      })

      if (response.success && response.data) {
        state.value.npmUser = response.data.npmUser
        state.value.avatar = response.data.avatar
        state.value.operations = response.data.operations
        state.value.connected = true
      }
    } catch {
      // Connection lost
      state.value.connected = false
      state.value.error = 'Connection lost'
    }
  }

  async function connectorFetch<T>(
    path: string,
    options: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> } = {},
  ): Promise<T | null> {
    if (!config.value) return null

    try {
      const response = await $fetch(`${baseUrl.value}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${config.value.token}`,
        },
        body: options.body,
        timeout: 30000,
      })
      return response as T
    } catch (err) {
      state.value.error = err instanceof Error ? err.message : 'Request failed'
      return null
    }
  }

  // Operation management

  async function addOperation(operation: NewOperation): Promise<PendingOperation | null> {
    const response = await connectorFetch<ApiResponse<PendingOperation>>('/operations', {
      method: 'POST',
      body: operation as unknown as Record<string, unknown>,
    })
    if (response?.success && response.data) {
      await refreshState()
      return response.data
    }
    return null
  }

  async function addOperations(operations: NewOperation[]): Promise<PendingOperation[]> {
    const response = await connectorFetch<ApiResponse<PendingOperation[]>>('/operations/batch', {
      method: 'POST',
      body: operations as unknown as Record<string, unknown>,
    })
    if (response?.success && response.data) {
      await refreshState()
      return response.data
    }
    return []
  }

  async function removeOperation(id: string): Promise<boolean> {
    const response = await connectorFetch<ApiResponse>(`/operations?id=${id}`, {
      method: 'DELETE',
    })
    if (response?.success) {
      await refreshState()
      return true
    }
    return false
  }

  async function clearOperations(): Promise<number> {
    const response = await connectorFetch<ApiResponse<{ removed: number }>>('/operations/all', {
      method: 'DELETE',
    })
    if (response?.success && response.data) {
      await refreshState()
      return response.data.removed
    }
    return 0
  }

  async function approveOperation(id: string): Promise<boolean> {
    const response = await connectorFetch<ApiResponse<PendingOperation>>(`/approve?id=${id}`, {
      method: 'POST',
    })
    if (response?.success) {
      await refreshState()
      return true
    }
    return false
  }

  async function retryOperation(id: string): Promise<boolean> {
    const response = await connectorFetch<ApiResponse<PendingOperation>>(`/retry?id=${id}`, {
      method: 'POST',
    })
    if (response?.success) {
      await refreshState()
      return true
    }
    return false
  }

  async function approveAll(): Promise<number> {
    const response = await connectorFetch<ApiResponse<{ approved: number }>>('/approve-all', {
      method: 'POST',
    })
    if (response?.success && response.data) {
      await refreshState()
      return response.data.approved
    }
    return 0
  }

  async function executeOperations(
    otp?: string,
  ): Promise<{ success: boolean; otpRequired?: boolean }> {
    const response = await connectorFetch<
      ApiResponse<{ results: unknown[]; otpRequired?: boolean }>
    >('/execute', {
      method: 'POST',
      body: otp ? { otp } : undefined,
    })
    if (response?.success) {
      await refreshState()
      // Update timestamp to trigger data refreshes in panels
      state.value.lastExecutionTime = Date.now()
      return {
        success: true,
        otpRequired: response.data?.otpRequired,
      }
    }
    return { success: false }
  }

  // Data fetching functions

  async function listOrgUsers(
    org: string,
  ): Promise<Record<string, 'developer' | 'admin' | 'owner'> | null> {
    const response = await connectorFetch<
      ApiResponse<Record<string, 'developer' | 'admin' | 'owner'>>
    >(`/org/${encodeURIComponent(org)}/users`)
    return response?.success ? (response.data ?? null) : null
  }

  async function listOrgTeams(org: string): Promise<string[] | null> {
    const response = await connectorFetch<ApiResponse<string[]>>(
      `/org/${encodeURIComponent(org)}/teams`,
    )
    return response?.success ? (response.data ?? null) : null
  }

  async function listTeamUsers(scopeTeam: string): Promise<string[] | null> {
    const response = await connectorFetch<ApiResponse<string[]>>(
      `/team/${encodeURIComponent(scopeTeam)}/users`,
    )
    return response?.success ? (response.data ?? null) : null
  }

  async function listPackageCollaborators(
    pkg: string,
  ): Promise<Record<string, 'read-only' | 'read-write'> | null> {
    const response = await connectorFetch<ApiResponse<Record<string, 'read-only' | 'read-write'>>>(
      `/package/${encodeURIComponent(pkg)}/collaborators`,
    )
    return response?.success ? (response.data ?? null) : null
  }

  async function listUserPackages(): Promise<Record<string, 'read-write' | 'read-only'> | null> {
    const response =
      await connectorFetch<ApiResponse<Record<string, 'read-write' | 'read-only'>>>(
        '/user/packages',
      )
    return response?.success ? (response.data ?? null) : null
  }

  async function listUserOrgs(): Promise<string[] | null> {
    const response = await connectorFetch<ApiResponse<string[]>>('/user/orgs')
    return response?.success ? (response.data ?? null) : null
  }

  // Computed helpers for operations
  const pendingOperations = computed(() =>
    state.value.operations.filter(op => op.status === 'pending'),
  )
  const approvedOperations = computed(() =>
    state.value.operations.filter(op => op.status === 'approved'),
  )
  /** Operations that are done (completed, or failed without needing OTP retry) */
  const completedOperations = computed(() =>
    state.value.operations.filter(
      op => op.status === 'completed' || (op.status === 'failed' && !op.result?.requiresOtp),
    ),
  )
  /** Operations that are still active (pending, approved, running, or failed needing OTP retry) */
  const activeOperations = computed(() =>
    state.value.operations.filter(
      op =>
        op.status === 'pending' ||
        op.status === 'approved' ||
        op.status === 'running' ||
        (op.status === 'failed' && op.result?.requiresOtp),
    ),
  )
  const hasOperations = computed(() => state.value.operations.length > 0)
  const hasPendingOperations = computed(() => pendingOperations.value.length > 0)
  const hasApprovedOperations = computed(() => approvedOperations.value.length > 0)
  const hasActiveOperations = computed(() => activeOperations.value.length > 0)
  const hasCompletedOperations = computed(() => completedOperations.value.length > 0)

  return {
    // State
    state: readonly(state),
    config: readonly(config),

    // Computed - connection
    isConnected: computed(() => state.value.connected),
    isConnecting: computed(() => state.value.connecting),
    npmUser: computed(() => state.value.npmUser),
    avatar: computed(() => state.value.avatar),
    error: computed(() => state.value.error),
    /** Timestamp of last execution completion (watch this to refresh data) */
    lastExecutionTime: computed(() => state.value.lastExecutionTime),

    // Computed - operations
    operations: computed(() => state.value.operations),
    pendingOperations,
    approvedOperations,
    completedOperations,
    activeOperations,
    hasOperations,
    hasPendingOperations,
    hasApprovedOperations,
    hasActiveOperations,
    hasCompletedOperations,

    // Actions - connection
    connect,
    reconnect,
    disconnect,
    refreshState,
    connectorFetch,

    // Actions - operations
    addOperation,
    addOperations,
    removeOperation,
    clearOperations,
    approveOperation,
    retryOperation,
    approveAll,
    executeOperations,

    // Actions - data fetching
    listOrgUsers,
    listOrgTeams,
    listTeamUsers,
    listPackageCollaborators,
    listUserPackages,
    listUserOrgs,
  }
})

// Re-export types for convenience
export type { PendingOperation, OperationStatus, OperationType }
