import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { defineComponent, h, ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DeprecatePackageModal from '~/components/Package/DeprecatePackageModal.vue'
import type { PendingOperation } from '../../../cli/src/types'

/** Internal state exposed on vm for testing (not in defineExpose) */
interface DeprecateModalVM {
  deprecateMessage?: Ref<string>
  deprecateVersion?: Ref<string>
  deprecateError?: Ref<string | null>
  deprecateSuccess?: Ref<boolean>
  handleDeprecate?: () => Promise<void>
  open?: () => void
  close?: () => void
}

function getVM(component: { vm: unknown }) {
  return component.vm as DeprecateModalVM
}

const mockAddOperation = vi.fn()
const mockApproveOperation = vi.fn()
const mockExecuteOperations = vi.fn()
const mockRefreshState = vi.fn()
const mockConnectorModalOpen = vi.fn()

const mockIsConnected = ref(true)
const mockState = ref<{ operations: PendingOperation[] }>({
  operations: [],
})

vi.mock('~/composables/useConnector', () => ({
  useConnector: () => ({
    isConnected: mockIsConnected,
    state: mockState,
    addOperation: (...args: unknown[]) => mockAddOperation(...args),
    approveOperation: (...args: unknown[]) => mockApproveOperation(...args),
    executeOperations: (...args: unknown[]) => mockExecuteOperations(...args),
    refreshState: (...args: unknown[]) => mockRefreshState(...args),
  }),
}))

vi.mock('~/composables/useModal', () => ({
  useModal: (id: string) => ({
    id,
    open: mockConnectorModalOpen,
    close: vi.fn(),
  }),
}))

// Stub Modal so slot content is rendered inline (no Teleport to body), making form elements findable
const ModalStub = defineComponent({
  name: 'ModalStub',
  inheritAttrs: false,
  setup() {
    const showModal = vi.fn()
    const close = vi.fn()
    return { showModal, close }
  },
  render() {
    return h('div', { ...this.$attrs, 'data-testid': 'modal-stub' }, this.$slots.default?.())
  },
})

const mountOptions = {
  global: {
    stubs: {
      Modal: ModalStub,
    },
  },
}

function createMockOperation(overrides: Partial<PendingOperation> = {}): PendingOperation {
  return {
    id: 'op-1',
    type: 'package:deprecate',
    params: { pkg: 'test-package', message: 'test message' },
    description: 'Deprecate test-package',
    command: 'npm deprecate test-package "test message"',
    status: 'completed',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('DeprecatePackageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsConnected.value = true
    mockState.value = { operations: [] }
  })

  describe('props and rendering', () => {
    it('renders with packageName only', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'my-pkg' },
        ...mountOptions,
      })

      expect(component.find('[data-testid="modal-stub"]').exists()).toBe(true)
      expect(component.find('#deprecate-message').exists()).toBe(true)
      expect(component.find('#deprecate-version').exists()).toBe(true)
    })

    it('renders with packageName and version', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'my-pkg', version: '2.0.0' },
        ...mountOptions,
      })

      const versionInput = component.find('#deprecate-version')
      expect(versionInput.exists()).toBe(true)
      expect((versionInput.element as HTMLInputElement).value).toBe('2.0.0')
    })
  })

  describe('exposed open() and close()', () => {
    it('open() resets form state and calls showModal on inner Modal', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg', version: '1.0.0' },
        ...mountOptions,
      })

      const modalStub = component.findComponent({ name: 'ModalStub' })
      expect(modalStub.exists()).toBe(true)
      getVM(component).open?.()

      expect(modalStub.vm.showModal).toHaveBeenCalled()
      const vm = getVM(component)
      expect(vm.deprecateMessage?.value ?? vm.deprecateMessage).toBe('')
      expect(vm.deprecateVersion?.value ?? vm.deprecateVersion).toBe('1.0.0')
      expect(vm.deprecateError?.value ?? vm.deprecateError).toBeNull()
      expect(vm.deprecateSuccess?.value ?? vm.deprecateSuccess).toBe(false)
    })

    it('close() calls close on inner Modal', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      const modalStub = component.findComponent({ name: 'ModalStub' })
      getVM(component).close?.()

      expect(modalStub.vm.close).toHaveBeenCalled()
    })
  })

  describe('form state', () => {
    it('deprecate button is disabled when message is empty', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      const buttons = component.findAll('button[type="button"]')
      const submitBtn = buttons.find(b => b.attributes('disabled') !== undefined)
      expect(submitBtn).toBeDefined()
    })

    it('deprecate button is enabled when message is filled and connected', async () => {
      mockIsConnected.value = true
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('Deprecated, use foo instead')
      await component.vm.$nextTick()

      const buttons = component.findAll('button[type="button"]')
      const submitBtn = buttons.find(b => b.attributes('disabled') === undefined)
      expect(submitBtn).toBeDefined()
    })

    it('handleDeprecate does nothing when not connected', async () => {
      mockIsConnected.value = false
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('message')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      expect(mockAddOperation).not.toHaveBeenCalled()
    })

    it('handleDeprecate does nothing when message is empty', async () => {
      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await getVM(component).handleDeprecate?.()

      expect(mockAddOperation).not.toHaveBeenCalled()
    })
  })

  describe('handleDeprecate flow', () => {
    it('calls addOperation with correct params (no version)', async () => {
      const op = createMockOperation({ status: 'completed' })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'test-package' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('  use other-pkg  ')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      expect(mockAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'package:deprecate',
          params: { pkg: 'test-package', message: 'use other-pkg' },
          description: 'Deprecate test-package',
          command: 'npm deprecate test-package "use other-pkg"',
        }),
      )
      expect(mockApproveOperation).toHaveBeenCalledWith('op-1')
      expect(mockExecuteOperations).toHaveBeenCalled()
      expect(mockRefreshState).toHaveBeenCalled()
    })

    it('calls addOperation with version when version is set', async () => {
      const op = createMockOperation({
        status: 'completed',
        params: { pkg: 'pkg', message: 'msg', version: '1.0.0' },
      })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg', version: '1.0.0' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('deprecated')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      expect(mockAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ pkg: 'pkg', message: 'deprecated', version: '1.0.0' }),
          description: 'Deprecate pkg@1.0.0',
          command: 'npm deprecate pkg@1.0.0 "deprecated"',
        }),
      )
    })

    it('shows success state when operation completes successfully', async () => {
      const op = createMockOperation({ status: 'completed' })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('use other')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      await component.vm.$nextTick()
      const success = getVM(component).deprecateSuccess?.value ?? getVM(component).deprecateSuccess
      expect(success).toBe(true)
      expect(component.html()).toMatch(/Package deprecated|deprecated/i)
    })

    it('shows error when operation fails without requiresOtp', async () => {
      const op = createMockOperation({
        status: 'failed',
        result: { stdout: '', stderr: 'EPERM', exitCode: 1 },
      })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('msg')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      await component.vm.$nextTick()
      const vm = getVM(component)
      expect(vm.deprecateError?.value ?? vm.deprecateError).toBe('EPERM')
      expect(vm.deprecateSuccess?.value ?? vm.deprecateSuccess).toBe(false)
    })

    it('closes modal and opens connector when operation fails with requiresOtp', async () => {
      const op = createMockOperation({
        status: 'failed',
        result: { stdout: '', stderr: '', exitCode: 1, requiresOtp: true },
      })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })
      const modalStub = component.findComponent({ name: 'ModalStub' })

      await component.find('#deprecate-message').setValue('msg')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      await component.vm.$nextTick()
      expect(modalStub.vm.close).toHaveBeenCalled()
      expect(mockConnectorModalOpen).toHaveBeenCalled()
    })

    it('closes modal and opens connector when operation is not completed', async () => {
      const op = createMockOperation({ status: 'pending' })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })
      const modalStub = component.findComponent({ name: 'ModalStub' })

      await component.find('#deprecate-message').setValue('msg')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      await component.vm.$nextTick()
      expect(modalStub.vm.close).toHaveBeenCalled()
      expect(mockConnectorModalOpen).toHaveBeenCalled()
    })

    it('sets deprecateError when addOperation throws', async () => {
      mockAddOperation.mockRejectedValue(new Error('Network error'))

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('msg')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      await component.vm.$nextTick()
      expect(getVM(component).deprecateError?.value ?? getVM(component).deprecateError).toBe(
        'Network error',
      )
    })

    it('escapes double quotes in command', async () => {
      const op = createMockOperation({ status: 'completed' })
      mockAddOperation.mockResolvedValue(op)
      mockApproveOperation.mockResolvedValue(true)
      mockExecuteOperations.mockResolvedValue({ success: true })
      mockRefreshState.mockImplementation(() => {
        mockState.value = { operations: [op] }
        return Promise.resolve()
      })

      const component = await mountSuspended(DeprecatePackageModal, {
        props: { packageName: 'pkg' },
        ...mountOptions,
      })

      await component.find('#deprecate-message').setValue('say "hello"')
      await component.vm.$nextTick()
      await getVM(component).handleDeprecate?.()

      expect(mockAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm deprecate pkg "say \\"hello\\""',
        }),
      )
    })
  })
})
