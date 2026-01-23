<script setup lang="ts">
const { isConnected, isConnecting, npmUser, error, activeOperations, hasPendingOperations } = useConnector()

const showModal = ref(false)

const statusText = computed(() => {
  if (isConnecting.value) return 'connecting…'
  if (isConnected.value && npmUser.value) return `@${npmUser.value}`
  if (isConnected.value) return 'connected'
  return 'disconnected'
})

const statusColor = computed(() => {
  if (isConnecting.value) return 'bg-yellow-500'
  if (isConnected.value) return 'bg-green-500'
  return 'bg-fg-subtle'
})

/** Only show count of active (pending/approved/running) operations */
const operationCount = computed(() => activeOperations.value.length)

const ariaLabel = computed(() => {
  if (error.value) return error.value
  if (isConnecting.value) return 'Connecting to local connector'
  if (isConnected.value) return 'Connected to local connector'
  return 'Click to connect to local connector'
})
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-fg-muted hover:text-fg bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
      :aria-label="ariaLabel"
      @click="showModal = true"
    >
      <span
        class="w-2 h-2 rounded-full transition-colors duration-200"
        :class="statusColor"
        aria-hidden="true"
      />
      <span class="hidden sm:inline">{{ statusText }}</span>
      <span class="sm:hidden">{{ isConnected ? 'on' : 'off' }}</span>
      <!-- Operation count badge (only active operations) -->
      <span
        v-if="isConnected && operationCount > 0"
        class="min-w-[1.25rem] h-5 px-1 flex items-center justify-center font-mono text-xs rounded-full"
        :class="hasPendingOperations ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'"
        aria-hidden="true"
      >
        {{ operationCount }}
      </span>
    </button>

    <ConnectorModal
      v-model:open="showModal"
    />
  </div>
</template>
