<script setup lang="ts">
const {
  isConnected,
  isConnecting,
  npmUser,
  avatar,
  error,
  activeOperations,
  hasPendingOperations,
} = useConnector()

const showModal = shallowRef(false)
const showTooltip = shallowRef(false)

const tooltipText = computed(() => {
  if (isConnecting.value) return 'connecting…'
  if (isConnected.value) return 'connected'
  return 'connect local CLI'
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
  <div class="relative flex items-center gap-2">
    <!-- Username link (when connected) -->
    <NuxtLink
      v-if="isConnected && npmUser"
      :to="`/~${npmUser}`"
      class="link-subtle font-mono text-sm hidden sm:inline"
    >
      @{{ npmUser }}
    </NuxtLink>

    <button
      type="button"
      class="relative flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
      :aria-label="ariaLabel"
      @click="showModal = true"
      @mouseenter="showTooltip = true"
      @mouseleave="showTooltip = false"
      @focus="showTooltip = true"
      @blur="showTooltip = false"
    >
      <!-- Avatar (when connected with avatar) -->
      <img
        v-if="isConnected && avatar"
        :src="avatar"
        :alt="`${npmUser}'s avatar`"
        class="w-6 h-6 rounded-full"
      />
      <!-- Status dot (when not connected or no avatar) -->
      <span
        v-else
        class="w-2.5 h-2.5 rounded-full transition-colors duration-200"
        :class="statusColor"
        aria-hidden="true"
      />
      <!-- Operation count badge (overlaid) -->
      <span
        v-if="isConnected && operationCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 flex items-center justify-center font-mono text-[10px] rounded-full"
        :class="hasPendingOperations ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'"
        aria-hidden="true"
      >
        {{ operationCount }}
      </span>
    </button>

    <!-- Tooltip -->
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showTooltip"
        role="tooltip"
        class="absolute right-0 top-full mt-2 px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-nowrap z-50"
      >
        {{ tooltipText }}
      </div>
    </Transition>

    <ConnectorModal v-model:open="showModal" />
  </div>
</template>
