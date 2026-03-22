<script setup lang="ts">
const { isConnected, isConnecting, npmUser, error, hasOperations, connect, disconnect } =
  useConnector()

const { settings } = useSettings()

const tokenInput = shallowRef('')
const portInput = shallowRef('31415')
const { copied, copy } = useClipboard({ copiedDuring: 2000 })

const hasAttemptedConnect = shallowRef(false)

watch(isConnected, connected => {
  if (!connected) {
    tokenInput.value = ''
    hasAttemptedConnect.value = false
  }
})

async function handleConnect() {
  hasAttemptedConnect.value = true
  const port = Number.parseInt(portInput.value, 10) || 31415
  await connect(tokenInput.value.trim(), port)
}

function handleDisconnect() {
  disconnect()
}

function copyCommand() {
  let command = executeNpmxConnectorCommand.value
  if (portInput.value !== '31415') {
    command += ` --port ${portInput.value}`
  }
  copy(command)
}

const selectedPM = useSelectedPackageManager()

const executeNpmxConnectorCommand = computed(() => {
  return getExecuteCommand({
    packageName: 'npmx-connector',
    packageManager: selectedPM.value,
  })
})
</script>

<template>
  <Modal
    :modalTitle="$t('connector.modal.title')"
    :class="isConnected && hasOperations ? 'max-w-2xl' : 'max-w-md'"
    id="connector-modal"
  >
    <!-- Connected state -->
    <div v-if="isConnected" class="space-y-4">
      <div class="flex items-center gap-3 p-4 bg-bg-subtle border border-border rounded-lg">
        <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
        <div>
          <p class="font-mono text-sm text-fg">{{ $t('connector.modal.connected') }}</p>
          <p v-if="npmUser" class="font-mono text-xs text-fg-muted">
            {{ $t('connector.modal.connected_as_user', { user: npmUser }) }}
          </p>
        </div>
      </div>

      <!-- Connector preferences -->
      <div class="flex flex-col gap-2">
        <SettingsToggle
          :label="$t('connector.modal.auto_open_url')"
          v-model="settings.connector.autoOpenURL"
        />
      </div>

      <div class="border-t border-border my-3" />

      <!-- Operations Queue -->
      <OrgOperationsQueue />

      <div v-if="!hasOperations" class="text-sm text-fg-muted">
        {{ $t('connector.modal.connected_hint') }}
      </div>

      <ButtonBase type="button" class="w-full" @click="handleDisconnect">
        {{ $t('connector.modal.disconnect') }}
      </ButtonBase>
    </div>

    <!-- Disconnected state -->
    <form v-else class="space-y-4" @submit.prevent="handleConnect">
      <p class="text-sm text-fg-muted">
        {{ $t('connector.modal.run_hint') }}
      </p>

      <div
        class="flex items-center p-3 bg-bg-muted border border-border rounded-lg font-mono text-sm"
        dir="ltr"
      >
        <span class="text-fg-subtle">$</span>
        <span class="text-fg-subtle ms-2">{{ executeNpmxConnectorCommand }}</span>
        <div class="ms-auto flex items-center gap-2">
          <!-- Disable teleport in a modal dialog -->
          <PackageManagerSelect :teleport="false" />

          <ButtonBase
            :aria-label="copied ? $t('connector.modal.copied') : $t('connector.modal.copy_command')"
            @click="copyCommand"
            class="ms-auto"
            :classicon="copied ? 'i-lucide:check text-green-500' : 'i-lucide:copy'"
          />
        </div>
      </div>

      <p class="text-sm text-fg-muted">{{ $t('connector.modal.paste_token') }}</p>

      <div class="space-y-3">
        <div>
          <label
            for="connector-token"
            class="block text-xs text-fg-subtle uppercase tracking-wider mb-1.5"
          >
            {{ $t('connector.modal.token_label') }}
          </label>
          <InputBase
            id="connector-token"
            v-model="tokenInput"
            type="password"
            name="connector-token"
            :placeholder="$t('connector.modal.token_placeholder')"
            no-correct
            class="w-full"
          />
        </div>

        <details class="text-sm">
          <summary class="text-fg-subtle hover:text-fg-muted transition-colors duration-200">
            {{ $t('connector.modal.advanced') }}
          </summary>
          <div class="mt-3">
            <label
              for="connector-port"
              class="block text-xs text-fg-subtle uppercase tracking-wider mb-1.5"
            >
              {{ $t('connector.modal.port_label') }}
            </label>
            <InputBase
              id="connector-port"
              v-model="portInput"
              type="text"
              name="connector-port"
              inputmode="numeric"
              autocomplete="off"
              class="w-full"
            />

            <div class="border-t border-border my-3" />
            <div class="flex flex-col gap-2">
              <SettingsToggle
                :label="$t('connector.modal.auto_open_url')"
                v-model="settings.connector.autoOpenURL"
              />
            </div>
          </div>
        </details>
      </div>

      <!-- Error message (only show after user explicitly clicks Connect) -->
      <div
        v-if="error && hasAttemptedConnect"
        role="alert"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
      >
        {{ error }}
      </div>

      <!-- Warning message -->
      <div
        role="alert"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
      >
        <p class="inline-block text-xs font-bold uppercase tracking-wider text-fg rounded">
          {{ $t('connector.modal.warning') }}
        </p>
        <p class="text-sm text-fg-muted mt-1">
          {{ $t('connector.modal.warning_text') }}
        </p>
      </div>

      <ButtonBase
        type="submit"
        variant="primary"
        :disabled="!tokenInput.trim() || isConnecting"
        class="w-full"
      >
        {{ isConnecting ? $t('connector.modal.connecting') : $t('connector.modal.connect') }}
      </ButtonBase>
    </form>
  </Modal>
</template>
