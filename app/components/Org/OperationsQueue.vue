<script setup lang="ts">
import type { PendingOperation } from '~~/cli/src/types'

const {
  isConnected,
  pendingOperations,
  approvedOperations,
  completedOperations,
  activeOperations,
  operations,
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
const otpError = shallowRef('')

const authUrl = computed(() => {
  const op = operations.value.find(o => o.status === 'running' && o.authUrl)
  return op?.authUrl ?? null
})

const authPollTimer = shallowRef<ReturnType<typeof setInterval> | null>(null)

function startAuthPolling() {
  stopAuthPolling()
  let remaining = 3
  authPollTimer.value = setInterval(async () => {
    try {
      await refreshState()
    } catch {
      stopAuthPolling()
      return
    }
    remaining--
    if (remaining <= 0) {
      stopAuthPolling()
    }
  }, 20000)
}

function stopAuthPolling() {
  if (authPollTimer.value) {
    clearInterval(authPollTimer.value)
    authPollTimer.value = null
  }
}

onUnmounted(stopAuthPolling)

function handleOpenAuthUrl() {
  if (authUrl.value) {
    window.open(authUrl.value, '_blank', 'noopener,noreferrer')
    startAuthPolling()
  }
}

/** Check if any active operation needs OTP (fallback for web auth failures) */
const hasOtpFailures = computed(() =>
  activeOperations.value.some(
    (op: PendingOperation) =>
      op.status === 'failed' && (op.result?.requiresOtp || op.result?.authFailure),
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
  const otp = otpInput.value.trim()

  if (!otp) {
    otpError.value = 'OTP required'
    return
  }

  if (!/^\d{6}$/.test(otp)) {
    otpError.value = 'OTP must be a 6-digit code'
    return
  }

  otpError.value = ''
  otpInput.value = ''

  // First, re-approve all OTP/auth-failed operations
  const otpFailedOps = activeOperations.value.filter(
    (op: PendingOperation) =>
      op.status === 'failed' && (op.result?.requiresOtp || op.result?.authFailure),
  )
  for (const op of otpFailedOps) {
    await retryOperation(op.id)
  }

  // Then execute with OTP
  await handleExecute(otp)
}

/** Retry failed operations with web auth (no OTP) */
async function handleRetryWebAuth() {
  // Find all failed operations that need auth retry
  const failedOps = activeOperations.value.filter(
    (op: PendingOperation) =>
      op.status === 'failed' && (op.result?.requiresOtp || op.result?.authFailure),
  )

  for (const op of failedOps) {
    await retryOperation(op.id)
  }

  await handleExecute()
}

async function handleClearAll() {
  await clearOperations()
  otpInput.value = ''
  otpError.value = ''
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
      return 'i-lucide:clock'
    case 'approved':
      return 'i-lucide:check'
    case 'running':
      return 'i-svg-spinners:ring-resize'
    case 'completed':
      return 'i-lucide:check'
    case 'failed':
      return 'i-lucide:x'
    default:
      return 'i-lucide:circle-question-mark'
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
          class="px-2 py-1 font-mono text-xs text-fg-muted hover:text-fg bg-bg-subtle border border-border rounded transition-colors duration-200 hover:border-border-hover focus-visible:outline-accent/70"
          :aria-label="$t('operations.queue.clear_all')"
          @click="handleClearAll"
        >
          {{ $t('operations.queue.clear_all') }}
        </button>
        <button
          type="button"
          class="p-1 text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
          :aria-label="$t('operations.queue.refresh')"
          @click="refreshState"
        >
          <span class="i-lucide:refresh-ccw w-4 h-4" aria-hidden="true" />
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
            class="p-1 text-fg-muted hover:text-green-400 transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('operations.queue.approve_operation')"
            @click="approveOperation(op.id)"
          >
            <span class="i-lucide:check w-4 h-4" aria-hidden="true" />
          </button>
          <button
            v-if="op.status !== 'running'"
            type="button"
            class="p-1 text-fg-muted hover:text-red-400 transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('operations.queue.remove_operation')"
            @click="removeOperation(op.id)"
          >
            <span class="i-lucide:x w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    </ul>

    <!-- Inline OTP prompt (appears when web auth fails and OTP is needed as fallback) -->
    <div
      v-if="hasOtpFailures"
      class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
      role="alert"
    >
      <div class="flex items-center gap-2 mb-2">
        <span class="i-lucide:lock w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
        <span class="font-mono text-sm text-amber-400">
          {{ $t('operations.queue.otp_prompt') }}
        </span>
      </div>
      <form class="flex flex-col gap-1" @submit.prevent="handleRetryWithOtp">
        <div class="flex items-center gap-2">
          <label for="otp-input" class="sr-only">{{ $t('operations.queue.otp_label') }}</label>
          <InputBase
            id="otp-input"
            v-model="otpInput"
            type="text"
            name="otp-code"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            :placeholder="$t('operations.queue.otp_placeholder')"
            autocomplete="one-time-code"
            spellcheck="false"
            :class="['flex-1 min-w-25', otpError ? 'border-red-500 focus:outline-red-500' : '']"
            size="small"
            @input="otpError = ''"
          />
          <button
            type="submit"
            :disabled="isExecuting"
            class="px-3 py-2 font-mono text-xs text-bg bg-amber-500 rounded transition-all duration-200 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
          >
            {{ isExecuting ? $t('operations.queue.retrying') : $t('operations.queue.retry_otp') }}
          </button>
        </div>
        <p v-if="otpError" class="text-xs text-red-400 font-mono">
          {{ otpError }}
        </p>
      </form>
      <div class="flex items-center gap-2 my-3">
        <div class="flex-1 h-px bg-amber-500/30" />
        <span class="text-xs text-amber-400 font-mono uppercase">{{ $t('common.or') }}</span>
        <div class="flex-1 h-px bg-amber-500/30" />
      </div>
      <button
        type="button"
        :disabled="isExecuting"
        class="w-full px-3 py-2 font-mono text-xs text-fg bg-bg-subtle border border-border rounded transition-all duration-200 hover:text-fg hover:border-border-hover disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleRetryWebAuth"
      >
        {{ isExecuting ? $t('operations.queue.retrying') : $t('operations.queue.retry_web_auth') }}
      </button>
    </div>

    <!-- Action buttons -->
    <div v-if="hasActiveOperations" class="flex items-center gap-2 pt-2">
      <button
        v-if="hasPendingOperations"
        type="button"
        class="flex-1 px-4 py-2 font-mono text-sm text-fg bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:border-border-hover focus-visible:outline-accent/70"
        @click="handleApproveAll"
      >
        {{ $t('operations.queue.approve_all') }} ({{ pendingOperations.length }})
      </button>
      <button
        v-if="hasApprovedOperations && !hasOtpFailures"
        type="button"
        :disabled="isExecuting"
        class="flex-1 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        @click="handleExecute()"
      >
        {{
          isExecuting
            ? $t('operations.queue.executing')
            : `${$t('operations.queue.execute')} (${approvedOperations.length})`
        }}
      </button>
      <button
        v-if="authUrl"
        type="button"
        class="flex-1 px-4 py-2 font-mono text-sm text-accent bg-accent/10 border border-accent/30 rounded-md transition-colors duration-200 hover:bg-accent/20"
        @click="handleOpenAuthUrl"
      >
        <span class="i-lucide:external-link w-4 h-4 inline-block me-1" aria-hidden="true" />
        {{ $t('operations.queue.open_web_auth') }}
      </button>
    </div>

    <!-- Completed operations log (collapsed by default) -->
    <details v-if="hasCompletedOperations" class="mt-4 border-t border-border pt-4">
      <summary
        class="flex items-center gap-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 select-none"
      >
        <span
          class="i-lucide:chevron-right rtl-flip w-3 h-3 transition-transform duration-200 [[open]>&]:rotate-90"
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
                ? 'i-lucide:check text-green-500'
                : 'i-lucide:x text-red-500'
            "
            class="w-3.5 h-3.5 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0">
            <span class="truncate block">{{ op.description }}</span>
            <!-- Show error output for failed operations -->
            <pre
              v-if="op.status === 'failed' && op.result?.stderr"
              class="mt-1 text-red-400/70 whitespace-pre-wrap text-2xs"
              >{{ op.result.stderr }}</pre
            >
          </div>
          <button
            type="button"
            class="p-0.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 rounded focus-visible:outline-accent/70"
            :aria-label="$t('operations.queue.remove_from_log')"
            @click="removeOperation(op.id)"
          >
            <span class="i-lucide:x w-3 h-3" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </details>
  </div>
</template>
