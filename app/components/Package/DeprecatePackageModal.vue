<script setup lang="ts">
import type { NewOperation } from '~/composables/useConnector'
import type Modal from '~/components/Modal.client.vue'
import { PackageDeprecateParamsSchema, safeParse } from '~~/cli/src/schemas'

const DEPRECATE_MESSAGE_MAX_LENGTH = 500

const props = withDefaults(
  defineProps<{
    packageName: string
    version?: string
  }>(),
  { version: '' },
)

const { t } = useI18n()
const { isConnected, state, addOperation, approveOperation, executeOperations, refreshState } =
  useConnector()

const deprecateMessage = ref('')
const deprecateVersion = ref(props.version)
const isDeprecating = shallowRef(false)
const deprecateSuccess = shallowRef(false)
const deprecateError = shallowRef<string | null>(null)

const connectorModal = useModal('connector-modal')

const modalTitle = computed(() =>
  deprecateVersion.value
    ? `${t('package.deprecation.modal.title')} ${props.packageName}@${deprecateVersion.value}`
    : `${t('package.deprecation.modal.title')} ${props.packageName}`,
)

async function handleDeprecate() {
  const message = deprecateMessage.value.trim()
  if (!isConnected.value) return

  const params: Record<string, string> = {
    pkg: props.packageName,
    message,
  }
  if (deprecateVersion.value.trim()) {
    params.version = deprecateVersion.value.trim()
  }

  const parsed = safeParse(PackageDeprecateParamsSchema, params)
  if (!parsed.success) {
    deprecateError.value = parsed.error
    return
  }

  isDeprecating.value = true
  deprecateError.value = null

  try {
    const escapedMessage = parsed.data.message.replace(/"/g, '\\"')
    const command = parsed.data.version
      ? `npm deprecate ${parsed.data.pkg}@${parsed.data.version} "${escapedMessage}"`
      : `npm deprecate ${parsed.data.pkg} "${escapedMessage}"`

    const operation = await addOperation({
      type: 'package:deprecate',
      params: {
        pkg: parsed.data.pkg,
        message: parsed.data.message,
        ...(parsed.data.version && { version: parsed.data.version }),
      },
      description: parsed.data.version
        ? `Deprecate ${parsed.data.pkg}@${parsed.data.version}`
        : `Deprecate ${parsed.data.pkg}`,
      command,
    } as NewOperation)

    if (!operation) {
      throw new Error('Failed to create operation')
    }

    await approveOperation(operation.id)
    await executeOperations()
    await refreshState()

    const completedOp = state.value.operations.find(op => op.id === operation.id)
    if (completedOp?.status === 'completed') {
      deprecateSuccess.value = true
    } else if (completedOp?.status === 'failed') {
      if (completedOp.result?.requiresOtp) {
        close()
        connectorModal.open()
      } else {
        deprecateError.value = completedOp.result?.stderr || t('common.try_again')
      }
    } else {
      close()
      connectorModal.open()
    }
  } catch (err) {
    deprecateError.value = err instanceof Error ? err.message : t('common.try_again')
  } finally {
    isDeprecating.value = false
  }
}

const dialogRef = ref<InstanceType<typeof Modal> | undefined>()

function open() {
  deprecateError.value = null
  deprecateSuccess.value = false
  deprecateMessage.value = ''
  deprecateVersion.value = props.version ?? ''
  dialogRef.value?.showModal()
}

function close() {
  dialogRef.value?.close()
}

defineExpose({ open, close })
</script>

<template>
  <Modal ref="dialogRef" :modal-title="modalTitle" id="deprecate-package-modal" class="max-w-md">
    <!-- Success state -->
    <div v-if="deprecateSuccess" class="space-y-4">
      <div
        class="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
      >
        <span class="i-carbon-checkmark-filled text-green-500 w-6 h-6" aria-hidden="true" />
        <div>
          <p class="font-mono text-sm text-fg">{{ $t('package.deprecation.modal.success') }}</p>
          <p class="text-xs text-fg-muted">
            {{ $t('package.deprecation.modal.success_detail') }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="close"
      >
        {{ $t('common.close') }}
      </button>
    </div>

    <!-- Form (only shown when connected; parent only opens modal when isConnected) -->
    <div v-else class="space-y-4">
      <div>
        <label for="deprecate-message" class="block text-sm font-medium text-fg mb-1">
          {{ $t('package.deprecation.modal.reason') }}
        </label>
        <textarea
          id="deprecate-message"
          v-model="deprecateMessage"
          rows="3"
          :maxlength="DEPRECATE_MESSAGE_MAX_LENGTH"
          class="w-full px-3 py-2 font-mono text-sm bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-fg/50"
          :placeholder="$t('package.deprecation.modal.reason_placeholder')"
          :aria-describedby="
            deprecateMessage.length >= DEPRECATE_MESSAGE_MAX_LENGTH
              ? 'deprecate-message-hint'
              : undefined
          "
        />
        <p
          v-if="deprecateMessage.length >= DEPRECATE_MESSAGE_MAX_LENGTH * 0.9"
          id="deprecate-message-hint"
          class="mt-1 text-xs text-fg-muted"
        >
          {{ deprecateMessage.length }} / {{ DEPRECATE_MESSAGE_MAX_LENGTH }}
        </p>
      </div>
      <div>
        <label for="deprecate-version" class="block text-sm font-medium text-fg mb-1">
          {{ $t('package.deprecation.modal.version') }}
        </label>
        <input
          id="deprecate-version"
          v-model="deprecateVersion"
          type="text"
          class="w-full px-3 py-2 font-mono text-sm bg-bg border border-border rounded-md text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-fg/50"
          :placeholder="$t('package.deprecation.modal.version_placeholder')"
        />
      </div>
      <div
        v-if="deprecateError"
        role="alert"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
      >
        {{ deprecateError }}
      </div>
      <button
        type="button"
        :disabled="isDeprecating || !deprecateMessage.trim()"
        class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="handleDeprecate"
      >
        {{
          isDeprecating
            ? $t('package.deprecation.modal.deprecating')
            : $t('package.deprecation.action')
        }}
      </button>
    </div>
  </Modal>
</template>
