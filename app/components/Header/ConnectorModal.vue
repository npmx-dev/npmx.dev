<script setup lang="ts">
const { isConnected, isConnecting, npmUser, error, hasOperations, connect, disconnect } =
  useConnector()

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

// function copyCommand() {
//   let command = executeNpmxConnectorCommand.value
//   if (portInput.value !== '31415') {
//     command += ` --port ${portInput.value}`
//   }
//   copy(command)
// }

// const selectedPM = useSelectedPackageManager()

// const executeNpmxConnectorCommand = computed(() => {
//   return getExecuteCommand({
//     packageName: 'npmx-connector',
//     packageManager: selectedPM.value,
//   })
// })
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

      <!-- Operations Queue -->
      <OrgOperationsQueue />

      <div v-if="!hasOperations" class="text-sm text-fg-muted">
        {{ $t('connector.modal.connected_hint') }}
      </div>

      <button
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-accent/70"
        @click="handleDisconnect"
      >
        {{ $t('connector.modal.disconnect') }}
      </button>
    </div>

    <!-- Disconnected state -->
    <form v-else class="space-y-4" @submit.prevent="handleConnect">
      <!-- Contributor-only notice -->
      <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <div>
          <span class="inline-block text-xs font-bold uppercase tracking-wider text-fg rounded">
            {{ $t('connector.modal.contributor_badge') }}
          </span>
          <p class="text-sm text-fg-muted">
            <i18n-t keypath="connector.modal.contributor_notice" scope="global">
              <template #link>
                <a
                  href="https://github.com/npmx-dev/npmx.dev/blob/main/CONTRIBUTING.md#local-connector-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-400 hover:underline"
                >
                  {{ $t('connector.modal.contributor_link') }}
                </a>
              </template>
            </i18n-t>
          </p>
        </div>
      </div>

      <p class="text-sm text-fg-muted">
        {{ $t('connector.modal.run_hint') }}
      </p>

      <div
        class="flex items-center p-3 bg-bg-muted border border-border rounded-lg font-mono text-sm"
      >
        <span class="text-fg-subtle">$</span>
        <span class="text-fg-subtle ms-2">pnpm npmx-connector</span>
        <button
          type="button"
          :aria-label="copied ? $t('connector.modal.copied') : $t('connector.modal.copy_command')"
          class="ms-auto text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
          @click="copy('pnpm npmx-connector')"
        >
          <span v-if="!copied" class="i-carbon:copy w-5 h-5" aria-hidden="true" />
          <span v-else class="i-carbon:checkmark w-5 h-5 text-green-500" aria-hidden="true" />
        </button>
      </div>

      <!-- TODO: Uncomment when npmx-connector is published to npm
                    <div
                      class="flex items-center p-3 bg-bg-muted border border-border rounded-lg font-mono text-sm"
                    >
                      <span class="text-fg-subtle">$</span>
                      <span class="text-fg-subtle ms-2">{{ executeNpmxConnectorCommand }}</span>
                      <div class="ms-auto flex items-center gap-2">
                        <PackageManagerSelect />

                        <button
                          type="button"
                          :aria-label="
                            copied ? $t('connector.modal.copied') : $t('connector.modal.copy_command')
                          "
                          class="ms-auto text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
                          @click="copyCommand"
                        >
                          <span v-if="!copied" class="i-carbon:copy w-5 h-5" aria-hidden="true" />
                          <span
                            v-else
                            class="i-carbon:checkmark w-5 h-5 text-green-500"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>
                    -->

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
            class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg placeholder:text-fg-subtle transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-accent/70"
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
              class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:outline-accent/70"
            />
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
        <p class="text-sm text-fg-muted">
          {{ $t('connector.modal.warning_text') }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="!tokenInput.trim() || isConnecting"
        class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {{ isConnecting ? $t('connector.modal.connecting') : $t('connector.modal.connect') }}
      </button>
    </form>
  </Modal>
</template>
