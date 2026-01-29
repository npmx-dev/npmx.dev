<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const { isConnected, isConnecting, npmUser, error, hasOperations, connect, disconnect } =
  useConnector()

const tokenInput = shallowRef('')
const portInput = shallowRef('31415')
const { copied, copy } = useClipboard({ copiedDuring: 2000 })

async function handleConnect() {
  const port = Number.parseInt(portInput.value, 10) || 31415
  const success = await connect(tokenInput.value.trim(), port)
  if (success) {
    tokenInput.value = ''
    open.value = false
  }
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

// Reset form when modal opens
watch(open, isOpen => {
  if (isOpen) {
    tokenInput.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          :aria-label="$t('connector.modal.close_modal')"
          @click="open = false"
        />

        <!-- Modal -->
        <div
          class="relative w-full bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain"
          :class="isConnected && hasOperations ? 'max-w-2xl' : 'max-w-md'"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connector-modal-title"
        >
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 id="connector-modal-title" class="font-mono text-lg font-medium">
                {{ $t('connector.modal.title') }}
              </h2>
              <button
                type="button"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                :aria-label="$t('common.close')"
                @click="open = false"
              >
                <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <!-- Connected state -->
            <div v-if="isConnected" class="space-y-4">
              <div class="flex items-center gap-3 p-4 bg-bg-subtle border border-border rounded-lg">
                <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
                <div>
                  <p class="font-mono text-sm text-fg">{{ $t('connector.modal.connected') }}</p>
                  <p v-if="npmUser" class="font-mono text-xs text-fg-muted">
                    {{ $t('connector.modal.logged_in_as', { user: npmUser }) }}
                  </p>
                </div>
              </div>

              <!-- Operations Queue -->
              <OperationsQueue />

              <div v-if="!hasOperations" class="text-sm text-fg-muted">
                {{ $t('connector.modal.connected_hint') }}
              </div>

              <button
                type="button"
                class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                @click="handleDisconnect"
              >
                {{ $t('connector.modal.disconnect') }}
              </button>
            </div>

            <!-- Disconnected state -->
            <form v-else class="space-y-4" @submit.prevent="handleConnect">
              <p class="text-sm text-fg-muted">
                {{ $t('connector.modal.run_hint') }}
              </p>

              <div
                class="flex items-center p-3 bg-bg-muted border border-border rounded-lg font-mono text-sm"
              >
                <span class="text-fg-subtle">$</span>
                <span class="text-fg-subtle ml-2">{{ executeNpmxConnectorCommand }}</span>
                <button
                  type="button"
                  :aria-label="
                    copied ? $t('connector.modal.copied') : $t('connector.modal.copy_command')
                  "
                  class="ml-auto text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                  @click="copyCommand"
                >
                  <span v-if="!copied" class="i-carbon-copy block w-5 h-5" aria-hidden="true" />
                  <span
                    v-else
                    class="i-carbon-checkmark block w-5 h-5 text-green-500"
                    aria-hidden="true"
                  />
                </button>
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
                  <input
                    id="connector-token"
                    v-model="tokenInput"
                    type="password"
                    name="connector-token"
                    :placeholder="$t('connector.modal.token_placeholder')"
                    v-bind="noCorrect"
                    class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  />
                </div>

                <details class="text-sm">
                  <summary
                    class="text-fg-subtle cursor-pointer hover:text-fg-muted transition-colors duration-200"
                  >
                    {{ $t('connector.modal.advanced') }}
                  </summary>
                  <div class="mt-3">
                    <label
                      for="connector-port"
                      class="block text-xs text-fg-subtle uppercase tracking-wider mb-1.5"
                    >
                      {{ $t('connector.modal.port_label') }}
                    </label>
                    <input
                      id="connector-port"
                      v-model="portInput"
                      type="text"
                      name="connector-port"
                      inputmode="numeric"
                      autocomplete="off"
                      class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    />
                  </div>
                </details>
              </div>

              <!-- Error message -->
              <div
                v-if="error"
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
                <p class="font-mono text-sm text-fg font-bold">
                  {{ $t('connector.modal.warning') }}
                </p>
                <p class="text-sm text-fg-muted">
                  {{ $t('connector.modal.warning_text') }}
                </p>
              </div>

              <button
                type="submit"
                :disabled="!tokenInput.trim() || isConnecting"
                class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {{
                  isConnecting ? $t('connector.modal.connecting') : $t('connector.modal.connect')
                }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
