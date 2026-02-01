<script setup lang="ts">
import type { PendingOperation } from '~~/cli/src/types'

const {
  isConnected,
  pendingOperations,
  approvedOperations,
  completedOperations,
  activeOperations,
  hasOperations,
  hasPendingOperations,
  hasApprovedOperations,
  hasActiveOperations,
  hasCompletedOperations,
  removeOperation,
  clearOperations,
  approveOperation,
  approveAll,
  executeOperations,
  retryOperation,
  refreshState,
} = useConnector()

const isExecuting = shallowRef(false)
const otpInput = shallowRef('')

/** Check if any active operation needs OTP */
const hasOtpFailures = computed(() =>
  activeOperations.value.some(
    (op: PendingOperation) => op.status === 'failed' && op.result?.requiresOtp,
  ),
)

async function handleApproveAll() {
  await approveAll()
}

async function handleExecute(otp?: string) {
  isExecuting.value = true
  try {
    await executeOperations(otp)
  } finally {
    isExecuting.value = false
  }
}

/** Retry all OTP-failed operations with the provided OTP */
async function handleRetryWithOtp() {
  if (!otpInput.value.trim()) return

  const otp = otpInput.value.trim()
  otpInput.value = ''

  // First, re-approve all OTP-failed operations
  const otpFailedOps = activeOperations.value.filter(
    (op: PendingOperation) => op.status === 'failed' && op.result?.requiresOtp,
  )
  for (const op of otpFailedOps) {
    await retryOperation(op.id)
  }

  // Then execute with OTP
  await handleExecute(otp)
}

async function handleClearAll() {
  await clearOperations()
  otpInput.value = ''
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500'
    case 'approved':
      return 'bg-blue-500'
    case 'running':
      return 'bg-purple-500'
    case 'completed':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    default:
      return 'bg-fg-subtle'
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return 'i-carbon:time'
    case 'approved':
      return 'i-carbon:checkmark'
    case 'running':
      return 'i-carbon:rotate-180'
    case 'completed':
      return 'i-carbon:checkmark-filled'
    case 'failed':
      return 'i-carbon:close-filled'
    default:
      return 'i-carbon:help'
  }
}

// Auto-refresh while executing
const { pause: pauseRefresh, resume: resumeRefresh } = useIntervalFn(() => refreshState(), 1000, {
  immediate: false,
})
watch(isExecuting, executing => {
  if (executing) {
    resumeRefresh()
  } else {
    pauseRefresh()
  }
})
</script>

<template>
  <div v-if="isConnected" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="font-mono text-sm font-medium text-fg">
        {{ $t('operations.queue.title') }}
        <span v-if="hasActiveOperations" class="text-fg-muted"
          >({{ activeOperations.length }})</span
        >
      </h3>
      <div class="flex items-center gap-2">
        <button
          v-if="hasOperations"
          type="button"
          class="px-2 py-1 font-mono text-xs text-fg-muted hover:text-fg bg-bg-subtle border border-border rounded transition-colors duration-200 hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :aria-label="$t('operations.queue.clear_all')"
          @click="handleClearAll"
        >
          {{ $t('operations.queue.clear_all') }}
        </button>
        <button
          type="button"
          class="p-1 text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :aria-label="$t('operations.queue.refresh')"
          @click="refreshState"
        >
          <span class="i-carbon:renew block w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasActiveOperations && !hasCompletedOperations" class="py-8 text-center">
      <p class="font-mono text-sm text-fg-subtle">{{ $t('operations.queue.empty') }}</p>
      <p class="font-mono text-xs text-fg-subtle mt-1">{{ $t('operations.queue.empty_hint') }}</p>
    </div>

    <!-- Active operations list -->
    <ul
      v-if="hasActiveOperations"
      class="space-y-2"
      :aria-label="$t('operations.queue.active_label')"
    >
      <li
        v-for="op in activeOperations"
        :key="op.id"
        class="flex items-start gap-3 p-3 bg-bg-subtle border border-border rounded-lg"
      >
        <!-- Status indicator -->
        <span
          class="flex-shrink-0 w-5 h-5 flex items-center justify-center"
          :aria-label="op.status"
        >
          <span
            :class="[getStatusIcon(op.status), getStatusColor(op.status).replace('bg-', 'text-')]"
            class="w-4 h-4"
            aria-hidden="true"
          />
        </span>

        <!-- Operation details -->
        <div class="flex-1 min-w-0">
          <p class="font-mono text-sm text-fg truncate">
            {{ op.description }}
          </p>
          <p class="font-mono text-xs text-fg-subtle mt-0.5 truncate">
            {{ op.command }}
          </p>
          <!-- OTP required indicator (brief, OTP prompt is shown below) -->
          <p
            v-if="op.result?.requiresOtp && op.status === 'failed'"
            class="mt-1 text-xs text-amber-400"
          >
            {{ $t('operations.queue.otp_required') }}
          </p>
          <!-- Result output for completed/failed -->
          <div
            v-else-if="op.result && (op.status === 'completed' || op.status === 'failed')"
            class="mt-2 p-2 bg-bg-muted border border-border rounded text-xs font-mono"
          >
            <pre v-if="op.result.stdout" class="text-fg-muted whitespace-pre-wrap">{{
              op.result.stdout
            }}</pre>
            <pre v-if="op.result.stderr" class="text-red-400 whitespace-pre-wrap">{{
              op.result.stderr
            }}</pre>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex-shrink-0 flex items-center gap-1">
          <button
            v-if="op.status === 'pending'"
            type="button"
            class="p-1 text-fg-muted hover:text-green-400 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('operations.queue.approve_operation')"
            @click="approveOperation(op.id)"
          >
            <span class="i-carbon:checkmark block w-4 h-4" aria-hidden="true" />
          </button>
          <button
            v-if="op.status !== 'running'"
            type="button"
            class="p-1 text-fg-muted hover:text-red-400 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('operations.queue.remove_operation')"
            @click="removeOperation(op.id)"
          >
            <span class="i-carbon-close block w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    </ul>

    <!-- Inline OTP prompt (appears when operations need OTP) -->
    <div
      v-if="hasOtpFailures"
      class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
      role="alert"
    >
      <div class="flex items-center gap-2 mb-2">
        <span class="i-carbon:locked block w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
        <span class="font-mono text-sm text-amber-400">
          {{ $t('operations.queue.otp_prompt') }}
        </span>
      </div>
      <form class="flex items-center gap-2" @submit.prevent="handleRetryWithOtp">
        <label for="otp-input" class="sr-only">{{ $t('operations.queue.otp_label') }}</label>
        <input
          id="otp-input"
          v-model="otpInput"
          type="text"
          name="otp-code"
          inputmode="numeric"
          pattern="[0-9]*"
          :placeholder="$t('operations.queue.otp_placeholder')"
          autocomplete="one-time-code"
          spellcheck="false"
          class="flex-1 px-3 py-1.5 font-mono text-sm bg-bg border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        />
        <button
          type="submit"
          :disabled="!otpInput.trim() || isExecuting"
          class="px-3 py-1.5 font-mono text-xs text-bg bg-amber-500 rounded transition-all duration-200 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
        >
          {{ isExecuting ? $t('operations.queue.retrying') : $t('operations.queue.retry_otp') }}
        </button>
      </form>
    </div>

    <!-- Action buttons -->
    <div v-if="hasActiveOperations" class="flex items-center gap-2 pt-2">
      <button
        v-if="hasPendingOperations"
        type="button"
        class="flex-1 px-4 py-2 font-mono text-sm text-fg bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="handleApproveAll"
      >
        {{ $t('operations.queue.approve_all') }} ({{ pendingOperations.length }})
      </button>
      <button
        v-if="hasApprovedOperations && !hasOtpFailures"
        type="button"
        :disabled="isExecuting"
        class="flex-1 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        @click="handleExecute()"
      >
        {{
          isExecuting
            ? $t('operations.queue.executing')
            : `${$t('operations.queue.execute')} (${approvedOperations.length})`
        }}
      </button>
    </div>

    <!-- Completed operations log (collapsed by default) -->
    <details v-if="hasCompletedOperations" class="mt-4 border-t border-border pt-4">
      <summary
        class="flex items-center gap-2 font-mono text-xs text-fg-muted cursor-pointer hover:text-fg transition-colors duration-200 select-none"
      >
        <span
          class="i-carbon:chevron-right rtl-flip block w-3 h-3 transition-transform duration-200 [[open]>&]:rotate-90"
          aria-hidden="true"
        />
        {{ $t('operations.queue.log') }} ({{ completedOperations.length }})
      </summary>
      <ul class="mt-2 space-y-1" :aria-label="$t('operations.queue.log_label')">
        <li
          v-for="op in completedOperations"
          :key="op.id"
          class="flex items-start gap-2 p-2 text-xs font-mono rounded"
          :class="op.status === 'completed' ? 'text-fg-muted' : 'text-red-400/80'"
        >
          <span
            :class="
              op.status === 'completed'
                ? 'i-carbon:checkmark-filled text-green-500'
                : 'i-carbon:close-filled text-red-500'
            "
            class="w-3.5 h-3.5 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0">
            <span class="truncate block">{{ op.description }}</span>
            <!-- Show error output for failed operations -->
            <pre
              v-if="op.status === 'failed' && op.result?.stderr"
              class="mt-1 text-red-400/70 whitespace-pre-wrap text-[11px]"
              >{{ op.result.stderr }}</pre
            >
          </div>
          <button
            type="button"
            class="p-0.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            :aria-label="$t('operations.queue.remove_from_log')"
            @click="removeOperation(op.id)"
          >
            <span class="i-carbon:close block w-3 h-3" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </details>
  </div>
</template>
