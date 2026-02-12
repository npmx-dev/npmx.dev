import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { ref, computed, readonly, nextTick } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import type { PendingOperation } from '../../../cli/src/types'
import { HeaderConnectorModal } from '#components'

// Mock state that will be controlled by tests
const mockState = ref({
  connected: false,
  connecting: false,
  npmUser: null as string | null,
  avatar: null as string | null,
  operations: [] as PendingOperation[],
  error: null as string | null,
  lastExecutionTime: null as number | null,
})

// Create the mock composable function
function createMockUseConnector() {
  return {
    state: readonly(mockState),
    isConnected: computed(() => mockState.value.connected),
    isConnecting: computed(() => mockState.value.connecting),
    npmUser: computed(() => mockState.value.npmUser),
    avatar: computed(() => mockState.value.avatar),
    error: computed(() => mockState.value.error),
    lastExecutionTime: computed(() => mockState.value.lastExecutionTime),
    operations: computed(() => mockState.value.operations),
    pendingOperations: computed(() =>
      mockState.value.operations.filter(op => op.status === 'pending'),
    ),
    approvedOperations: computed(() =>
      mockState.value.operations.filter(op => op.status === 'approved'),
    ),
    completedOperations: computed(() =>
      mockState.value.operations.filter(
        op => op.status === 'completed' || (op.status === 'failed' && !op.result?.requiresOtp),
      ),
    ),
    activeOperations: computed(() =>
      mockState.value.operations.filter(
        op =>
          op.status === 'pending' ||
          op.status === 'approved' ||
          op.status === 'running' ||
          (op.status === 'failed' && (op.result?.requiresOtp || op.result?.authFailure)),
      ),
    ),
    hasOperations: computed(() => mockState.value.operations.length > 0),
    hasPendingOperations: computed(() =>
      mockState.value.operations.some(op => op.status === 'pending'),
    ),
    hasApprovedOperations: computed(() =>
      mockState.value.operations.some(op => op.status === 'approved'),
    ),
    hasActiveOperations: computed(() =>
      mockState.value.operations.some(
        op =>
          op.status === 'pending' ||
          op.status === 'approved' ||
          op.status === 'running' ||
          (op.status === 'failed' && (op.result?.requiresOtp || op.result?.authFailure)),
      ),
    ),
    hasCompletedOperations: computed(() =>
      mockState.value.operations.some(
        op =>
          op.status === 'completed' ||
          (op.status === 'failed' && !op.result?.requiresOtp && !op.result?.authFailure),
      ),
    ),
    connect: vi.fn().mockResolvedValue(true),
    reconnect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    refreshState: vi.fn().mockResolvedValue(undefined),
    addOperation: vi.fn().mockResolvedValue(null),
    addOperations: vi.fn().mockResolvedValue([]),
    removeOperation: vi.fn().mockResolvedValue(true),
    clearOperations: vi.fn().mockResolvedValue(0),
    approveOperation: vi.fn().mockResolvedValue(true),
    retryOperation: vi.fn().mockResolvedValue(true),
    approveAll: vi.fn().mockResolvedValue(0),
    executeOperations: vi.fn().mockResolvedValue({ success: true }),
    listOrgUsers: vi.fn().mockResolvedValue(null),
    listOrgTeams: vi.fn().mockResolvedValue(null),
    listTeamUsers: vi.fn().mockResolvedValue(null),
    listPackageCollaborators: vi.fn().mockResolvedValue(null),
    listUserPackages: vi.fn().mockResolvedValue(null),
    listUserOrgs: vi.fn().mockResolvedValue(null),
  }
}

function resetMockState() {
  mockState.value = {
    connected: false,
    connecting: false,
    npmUser: null,
    avatar: null,
    operations: [],
    error: null,
    lastExecutionTime: null,
  }
  mockSettings.value.connector = {
    autoOpenURL: false,
  }
}

function simulateConnect() {
  mockState.value.connected = true
  mockState.value.npmUser = 'testuser'
  mockState.value.avatar = 'https://example.com/avatar.png'
}

const mockSettings = ref({
  relativeDates: false,
  includeTypesInInstall: true,
  accentColorId: null,
  hidePlatformPackages: true,
  selectedLocale: null,
  preferredBackgroundTheme: null,
  searchProvider: 'npm',
  connector: {
    autoOpenURL: false,
  },
  sidebar: {
    collapsed: [],
  },
})

mockNuxtImport('useConnector', () => {
  return createMockUseConnector
})

mockNuxtImport('useSettings', () => {
  return () => ({ settings: mockSettings })
})

mockNuxtImport('useSelectedPackageManager', () => {
  return () => ref('npm')
})

vi.mock('~/utils/npm', () => ({
  getExecuteCommand: () => 'npx npmx-connector',
}))

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('navigator', {
  ...navigator,
  clipboard: {
    writeText: mockWriteText,
    readText: vi.fn().mockResolvedValue(''),
  },
})

// Track current wrapper for cleanup
let currentWrapper: VueWrapper | null = null

/**
 * Get the modal dialog element from the document body (where Teleport sends it).
 */
function getModalDialog(): HTMLDialogElement | null {
  return document.body.querySelector('dialog#connector-modal')
}

/**
 * Mount the component and open the dialog via showModal().
 */
async function mountAndOpen(state?: 'connected' | 'error') {
  if (state === 'connected') simulateConnect()
  if (state === 'error') {
    mockState.value.error = 'Could not reach connector. Is it running?'
  }

  currentWrapper = await mountSuspended(HeaderConnectorModal, {
    attachTo: document.body,
  })
  await nextTick()

  const dialog = getModalDialog()
  dialog?.showModal()
  await nextTick()

  return dialog
}

// Reset state before each test
beforeEach(() => {
  resetMockState()
  mockWriteText.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
  if (currentWrapper) {
    currentWrapper.unmount()
    currentWrapper = null
  }
})

describe('HeaderConnectorModal', () => {
  describe('Connector preferences (connected)', () => {
    it('shows auto-open URL toggle when connected', async () => {
      const dialog = await mountAndOpen('connected')
      const labels = Array.from(dialog?.querySelectorAll('label, span') ?? [])
      const autoOpenLabel = labels.find(el => el.textContent?.includes('open auth page'))
      expect(autoOpenLabel).toBeTruthy()
    })

    it('does not show a web auth toggle (web auth is now always on)', async () => {
      const dialog = await mountAndOpen('connected')
      const labels = Array.from(dialog?.querySelectorAll('label, span') ?? [])
      const webAuthLabel = labels.find(el => el.textContent?.includes('web authentication'))
      expect(webAuthLabel).toBeUndefined()
    })
  })

  describe('Auth URL button', () => {
    it('does not show auth URL button when no running operations have an authUrl', async () => {
      const dialog = await mountAndOpen('connected')

      const buttons = Array.from(dialog?.querySelectorAll('button') ?? [])
      const authUrlBtn = buttons.find(b => b.textContent?.includes('web auth link'))
      expect(authUrlBtn).toBeUndefined()
    })

    it('shows auth URL button when a running operation has an authUrl', async () => {
      mockState.value.operations = [
        {
          id: '0000000000000001',
          type: 'org:add-user',
          params: { org: 'myorg', user: 'alice', role: 'developer' },
          description: 'Add alice',
          command: 'npm org set myorg alice developer',
          status: 'running',
          createdAt: Date.now(),
          authUrl: 'https://www.npmjs.com/login?next=/login/cli/abc123',
        },
      ]
      const dialog = await mountAndOpen('connected')

      const buttons = Array.from(dialog?.querySelectorAll('button') ?? [])
      const authUrlBtn = buttons.find(b => b.textContent?.includes('web auth link'))
      expect(authUrlBtn).toBeTruthy()
    })

    it('opens auth URL in new tab when button is clicked', async () => {
      const mockOpen = vi.fn()
      vi.stubGlobal('open', mockOpen)

      mockState.value.operations = [
        {
          id: '0000000000000001',
          type: 'org:add-user',
          params: { org: 'myorg', user: 'alice', role: 'developer' },
          description: 'Add alice',
          command: 'npm org set myorg alice developer',
          status: 'running',
          createdAt: Date.now(),
          authUrl: 'https://www.npmjs.com/login?next=/login/cli/abc123',
        },
      ]
      const dialog = await mountAndOpen('connected')

      const buttons = Array.from(dialog?.querySelectorAll('button') ?? [])
      const authUrlBtn = buttons.find(b =>
        b.textContent?.includes('web auth link'),
      ) as HTMLButtonElement
      authUrlBtn?.click()
      await nextTick()

      expect(mockOpen).toHaveBeenCalledWith(
        'https://www.npmjs.com/login?next=/login/cli/abc123',
        '_blank',
        'noopener,noreferrer',
      )

      vi.unstubAllGlobals()
      // Re-stub navigator.clipboard which was unstubbed
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: {
          writeText: mockWriteText,
          readText: vi.fn().mockResolvedValue(''),
        },
      })
    })
  })

  describe('Operations queue in connected state', () => {
    it('renders OTP prompt when operations have OTP failures', async () => {
      mockState.value.operations = [
        {
          id: '0000000000000001',
          type: 'org:add-user',
          params: { org: 'myorg', user: 'alice', role: 'developer' },
          description: 'Add alice',
          command: 'npm org set myorg alice developer',
          status: 'failed',
          createdAt: Date.now(),
          result: { stdout: '', stderr: 'otp required', exitCode: 1, requiresOtp: true },
        },
      ]
      const dialog = await mountAndOpen('connected')

      // The OrgOperationsQueue child should render with the OTP alert
      const otpAlert = dialog?.querySelector('[role="alert"]')
      expect(otpAlert).not.toBeNull()
      expect(dialog?.innerHTML).toContain('otp-input')
    })

    it('does not show retry with web auth when there are no auth failures', async () => {
      mockState.value.operations = [
        {
          id: '0000000000000001',
          type: 'org:add-user',
          params: { org: 'myorg', user: 'alice', role: 'developer' },
          description: 'Add alice',
          command: 'npm org set myorg alice developer',
          status: 'approved',
          createdAt: Date.now(),
        },
      ]
      const dialog = await mountAndOpen('connected')

      const html = dialog?.innerHTML ?? ''
      const hasWebAuthButton =
        html.includes('Retry with web auth') || html.includes('retry_web_auth')
      expect(hasWebAuthButton).toBe(false)
    })

    it('shows OTP alert section for operations with authFailure (not just requiresOtp)', async () => {
      mockState.value.operations = [
        {
          id: '0000000000000001',
          type: 'org:add-user',
          params: { org: 'myorg', user: 'alice', role: 'developer' },
          description: 'Add alice',
          command: 'npm org set myorg alice developer',
          status: 'failed',
          createdAt: Date.now(),
          result: { stdout: '', stderr: 'auth failed', exitCode: 1, authFailure: true },
        },
      ]
      const dialog = await mountAndOpen('connected')

      // The OTP/auth failures section should render for authFailure too
      const otpAlert = dialog?.querySelector('[role="alert"]')
      expect(otpAlert).not.toBeNull()
    })
  })

  describe('Disconnected state', () => {
    it('shows connection form when not connected', async () => {
      const dialog = await mountAndOpen()
      expect(dialog).not.toBeNull()

      // Should show the form (disconnected state)
      const form = dialog?.querySelector('form')
      expect(form).not.toBeNull()

      // Should show token input
      const tokenInput = dialog?.querySelector('input[name="connector-token"]')
      expect(tokenInput).not.toBeNull()

      // Should show connect button
      const connectButton = dialog?.querySelector('button[type="submit"]')
      expect(connectButton).not.toBeNull()
    })

    it('shows the CLI command to run', async () => {
      const dialog = await mountAndOpen()
      // The command is now "pnpm npmx-connector"
      expect(dialog?.textContent).toContain('npmx-connector')
    })

    it('has a copy button for the command', async () => {
      const dialog = await mountAndOpen()
      // The copy button is inside the command block (dir="ltr" div)
      const commandBlock = dialog?.querySelector('div[dir="ltr"]')
      const copyBtn = commandBlock?.querySelector('button') as HTMLButtonElement
      expect(copyBtn).toBeTruthy()
      // The button should have a copy-related aria-label
      expect(copyBtn?.getAttribute('aria-label')).toBeTruthy()
    })

    it('disables connect button when token is empty', async () => {
      const dialog = await mountAndOpen()
      const connectButton = dialog?.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(connectButton?.disabled).toBe(true)
    })

    it('enables connect button when token is entered', async () => {
      const dialog = await mountAndOpen()
      const tokenInput = dialog?.querySelector('input[name="connector-token"]') as HTMLInputElement
      expect(tokenInput).not.toBeNull()

      // Set value and dispatch input event to trigger v-model
      tokenInput.value = 'my-test-token'
      tokenInput.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      const connectButton = dialog?.querySelector('button[type="submit"]') as HTMLButtonElement
      expect(connectButton?.disabled).toBe(false)
    })

    it('shows error message when connection fails', async () => {
      const dialog = await mountAndOpen('error')
      // Error needs hasAttemptedConnect=true to show. Simulate a connect attempt first.
      const tokenInput = dialog?.querySelector('input[name="connector-token"]') as HTMLInputElement
      tokenInput.value = 'bad-token'
      tokenInput.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()

      const form = dialog?.querySelector('form')
      form?.dispatchEvent(new Event('submit', { bubbles: true }))
      await nextTick()

      const alerts = dialog?.querySelectorAll('[role="alert"]')
      const errorAlert = Array.from(alerts || []).find(el =>
        el.textContent?.includes('Could not reach connector'),
      )
      expect(errorAlert).not.toBeUndefined()
    })
  })

  describe('Connected state', () => {
    it('shows connected status', async () => {
      const dialog = await mountAndOpen('connected')
      expect(dialog?.textContent).toContain('Connected')
    })

    it('shows logged in username', async () => {
      const dialog = await mountAndOpen('connected')
      expect(dialog?.textContent).toContain('testuser')
    })

    it('shows disconnect button', async () => {
      const dialog = await mountAndOpen('connected')
      const buttons = dialog?.querySelectorAll('button')
      const disconnectBtn = Array.from(buttons || []).find(b =>
        b.textContent?.toLowerCase().includes('disconnect'),
      )
      expect(disconnectBtn).not.toBeUndefined()
    })

    it('hides connection form when connected', async () => {
      const dialog = await mountAndOpen('connected')
      const form = dialog?.querySelector('form')
      expect(form).toBeNull()
    })
  })

  describe('Modal behavior', () => {
    it('closes modal when close button is clicked', async () => {
      const dialog = await mountAndOpen()

      // Find the close button (ButtonBase with close icon) in the dialog header
      const closeBtn = Array.from(dialog?.querySelectorAll('button') ?? []).find(
        b =>
          b.querySelector('[class*="close"]') ||
          b.getAttribute('aria-label')?.toLowerCase().includes('close'),
      ) as HTMLButtonElement
      expect(closeBtn).toBeTruthy()

      closeBtn?.click()
      await nextTick()

      // Dialog should be closed (open attribute removed)
      expect(dialog?.open).toBe(false)
    })

    it('does not render dialog content when not opened', async () => {
      currentWrapper = await mountSuspended(HeaderConnectorModal, {
        attachTo: document.body,
      })
      await nextTick()

      const dialog = getModalDialog()
      // Dialog exists in DOM but should not be open
      expect(dialog?.open).toBeFalsy()
    })
  })
})
