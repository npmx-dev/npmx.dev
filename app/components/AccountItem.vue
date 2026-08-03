<script setup lang="ts">
import type {
  KeytraceAccount,
  KeytraceReverifyRequest,
  KeytraceReverifyResponse,
  KeytraceVerificationStatus,
} from '#shared/types/keytrace'

const props = defineProps<{
  identity: string
  account: KeytraceAccount
}>()

const { t } = useI18n()

const platformLabelMap: Record<string, string> = {
  github: 'GitHub',
  npm: 'npm',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  discord: 'Discord',
  orcid: 'ORCID',
}

const platformIconMap: Record<string, string> = {
  github: 'i-simple-icons:github',
  npm: 'i-simple-icons:npm',
  mastodon: 'i-simple-icons:mastodon',
  bluesky: 'i-simple-icons:bluesky',
  discord: 'i-simple-icons:discord',
  orcid: 'i-simple-icons:orcid',
}

const proofMethodLabelMap: Record<KeytraceAccount['proofMethod'], string> = {
  dns: 'DNS',
  github: 'GitHub',
  npm: 'npm',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  pgp: 'PGP',
  other: 'other',
}

const statusLabelMap: Record<KeytraceAccount['status'], { key: string; fallback: string }> = {
  verified: { key: 'profile.linked_accounts.status.verified', fallback: 'Verified' },
  unverified: { key: 'profile.linked_accounts.status.unverified', fallback: 'Unverified' },
  stale: { key: 'profile.linked_accounts.status.stale', fallback: 'Stale' },
  failed: { key: 'profile.linked_accounts.status.failed', fallback: 'Failed' },
}

const statusClassMap: Record<KeytraceAccount['status'], string> = {
  verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  unverified: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  stale: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
}

const platformLabel = computed(() => {
  const normalizedPlatform = props.account.platform.toLowerCase()
  return platformLabelMap[normalizedPlatform] ?? props.account.platform
})

const platformIconClass = computed(() => {
  const normalizedPlatform = props.account.platform.toLowerCase()
  return platformIconMap[normalizedPlatform] ?? 'i-lucide:user-round'
})

const accountDisplayName = computed(() => props.account.displayName || props.account.username)
const accountAvatar = computed(() => props.account.avatar)

const localStatus = ref<KeytraceVerificationStatus>(props.account.status)
const localLastCheckedAt = ref(props.account.lastCheckedAt)
const localFailureReason = ref(props.account.failureReason)
const isReverifying = ref(false)
const reverifyError = ref<string | null>(null)
const panelVisible = ref(false)
const currentVerificationStep = ref(-1)
const reverifyTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null)

const verificationSteps = [
  'Matching service provider',
  'Fetching proof',
  'Checking for DID',
  'Server verification',
]

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown
      statusMessage?: unknown
      data?: { message?: unknown }
    }

    if (typeof maybeError.data?.message === 'string' && maybeError.data.message.trim()) {
      return maybeError.data.message
    }

    if (typeof maybeError.statusMessage === 'string' && maybeError.statusMessage.trim()) {
      return maybeError.statusMessage
    }

    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message
    }
  }

  return 'Unknown error'
}

watch(
  () => props.account,
  account => {
    localStatus.value = account.status
    localLastCheckedAt.value = account.lastCheckedAt
    localFailureReason.value = account.failureReason
  },
  { immediate: true },
)

const statusLabel = computed(() => {
  const statusEntry = statusLabelMap[localStatus.value]
  const translatedStatus = t(statusEntry.key)

  return translatedStatus === statusEntry.key ? statusEntry.fallback : translatedStatus
})
const statusClasses = computed(() => statusClassMap[localStatus.value])
const proofMethodLabel = computed(() => proofMethodLabelMap[props.account.proofMethod])

const shouldShowFailureReason = computed(
  () =>
    !!localFailureReason.value &&
    (localStatus.value === 'failed' ||
      localStatus.value === 'stale' ||
      localStatus.value === 'unverified'),
)

function closeReverifyPanel() {
  panelVisible.value = false
}

function cancelReverifyTimeout() {
  if (reverifyTimeoutId.value) {
    clearTimeout(reverifyTimeoutId.value)
    reverifyTimeoutId.value = null
  }
}

onUnmounted(() => {
  cancelReverifyTimeout()
})

async function reverifyAccount() {
  cancelReverifyTimeout()
  isReverifying.value = true
  reverifyError.value = null
  panelVisible.value = true
  currentVerificationStep.value = -1

  const runStep = async (stepIndex: number) => {
    currentVerificationStep.value = stepIndex
    await new Promise(resolve => setTimeout(resolve, 220))
  }

  try {
    const body: KeytraceReverifyRequest = {
      identity: props.identity,
      platform: props.account.platform,
      username: props.account.username,
      url: props.account.url,
    }

    const responsePromise = $fetch<KeytraceReverifyResponse>('/api/keytrace/reverify', {
      method: 'POST',
      body,
    })

    // Attach rejection handler to prevent unhandled promise rejection warnings
    responsePromise.catch(() => {})

    await runStep(0)
    await runStep(1)
    await runStep(2)
    await runStep(3)

    const response = await responsePromise

    localStatus.value = response.status
    localLastCheckedAt.value = response.lastCheckedAt
    localFailureReason.value = response.failureReason
    currentVerificationStep.value = verificationSteps.length
  } catch (error) {
    // oxlint-disable-next-line no-console -- log reverify failures for observability
    console.error('[keytrace] reverify failed', error)
    const errorMessage = getErrorMessage(error)
    localFailureReason.value = errorMessage
    reverifyError.value = `Re-verification failed: ${errorMessage}`
  } finally {
    isReverifying.value = false

    const closeDelay = reverifyError.value ? 3000 : 1000
    reverifyTimeoutId.value = setTimeout(() => {
      closeReverifyPanel()
      reverifyTimeoutId.value = null
    }, closeDelay)
  }
}
function getStepState(stepIndex: number): 'done' | 'active' | 'idle' {
  if (currentVerificationStep.value > stepIndex) {
    return 'done'
  }

  if (currentVerificationStep.value === stepIndex && isReverifying.value && !reverifyError.value) {
    return 'active'
  }

  if (currentVerificationStep.value >= verificationSteps.length) {
    return 'done'
  }

  return 'idle'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}
</script>

<template>
  <div class="rounded-md border border-border bg-bg-subtle px-3 py-3 sm:px-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-3 min-w-0">
          <LinkBase
            v-if="account.url"
            :to="account.url"
            noUnderline
            class="inline-flex items-center gap-3 min-w-0 hover:text-accent"
          >
            <div
              class="size-10 rounded-full border border-border overflow-hidden bg-bg-muted shrink-0 flex items-center justify-center"
            >
              <img
                v-if="accountAvatar"
                :src="accountAvatar"
                :alt="accountDisplayName"
                class="w-full h-full object-cover"
              />
              <span v-else :class="platformIconClass" class="size-4" aria-hidden="true" />
            </div>
            <p class="font-mono text-base sm:text-lg font-medium min-w-0 break-words">
              {{ accountDisplayName }}
            </p>
          </LinkBase>

          <div v-else class="inline-flex items-center gap-3 min-w-0">
            <div
              class="size-10 rounded-full border border-border overflow-hidden bg-bg-muted shrink-0 flex items-center justify-center"
            >
              <img
                v-if="accountAvatar"
                :src="accountAvatar"
                :alt="accountDisplayName"
                class="w-full h-full object-cover"
              />
              <span v-else :class="platformIconClass" class="size-4" aria-hidden="true" />
            </div>
            <p class="font-mono text-base sm:text-lg font-medium min-w-0 break-words">
              {{ accountDisplayName }}
            </p>
          </div>

          <span
            class="inline-flex items-center rounded-full border px-2 h-5 text-xs font-mono leading-5"
            :class="statusClasses"
          >
            {{ statusLabel }}
          </span>
        </div>

        <p class="mt-2 text-sm text-fg-muted min-w-0 break-words">
          via {{ proofMethodLabel }}
          <span aria-hidden="true" class="mx-1">&middot;</span>
          Added {{ formatDate(account.addedAt) }}
          <span aria-hidden="true" class="mx-1">&middot;</span>
          Last checked {{ formatDate(localLastCheckedAt) }}
        </p>

        <p v-if="shouldShowFailureReason" class="mt-2 text-sm text-fg-muted min-w-0 break-words">
          {{ localFailureReason }}
        </p>
      </div>

      <div class="flex flex-col items-end gap-2 shrink-0">
        <div class="flex items-center gap-2">
          <TooltipBase
            :is-visible="panelVisible || isReverifying"
            position="bottom"
            :offset="8"
            interactive
            :tooltip-attr="{ 'role': 'dialog', 'aria-label': 'Re-verify claim' }"
          >
            <ButtonBase
              size="sm"
              :disabled="isReverifying"
              :classicon="isReverifying ? 'i-lucide:loader-circle' : 'i-lucide:refresh-cw'"
              @click="reverifyAccount"
            >
              {{ isReverifying ? 'Checking...' : 'Re-verify' }}
            </ButtonBase>

            <template #content>
              <div class="w-72 max-w-full p-2 sm:p-3">
                <p class="font-mono text-sm font-medium">Re-verify Claim</p>
                <p class="text-sm text-fg-subtle mt-1">{{ platformLabel }}</p>

                <ul class="mt-3 space-y-2">
                  <li
                    v-for="(stepLabel, stepIndex) in verificationSteps"
                    :key="stepLabel"
                    class="flex items-center gap-2 text-sm"
                    :class="{
                      'text-fg': getStepState(stepIndex) === 'done',
                      'text-fg-subtle': getStepState(stepIndex) === 'idle',
                    }"
                  >
                    <span
                      class="size-4 inline-flex items-center justify-center rounded-full border"
                      :class="{
                        'border-emerald-400/60 text-emerald-300':
                          getStepState(stepIndex) === 'done',
                        'border-accent/70 text-accent': getStepState(stepIndex) === 'active',
                        'border-border text-fg-subtle': getStepState(stepIndex) === 'idle',
                      }"
                    >
                      <span
                        v-if="getStepState(stepIndex) === 'done'"
                        class="i-lucide:check size-3"
                        aria-hidden="true"
                      />
                      <span
                        v-else-if="getStepState(stepIndex) === 'active'"
                        class="i-lucide:loader-circle size-3 animate-spin"
                        aria-hidden="true"
                      />
                      <span v-else class="size-2 rounded-full bg-current/70" aria-hidden="true" />
                    </span>
                    <span>{{ stepLabel }}</span>
                  </li>
                </ul>
              </div>
            </template>
          </TooltipBase>
        </div>

        <p
          v-if="reverifyError"
          class="text-sm text-red-300 min-w-0 break-words text-end"
          role="alert"
        >
          {{ reverifyError }}
        </p>
      </div>
    </div>
  </div>
</template>
