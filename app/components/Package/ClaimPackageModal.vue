<script setup lang="ts">
import { checkPackageName } from '~/utils/package-name'

const props = defineProps<{
  packageName: string
}>()

const {
  isConnected,
  state,
  npmUser,
  addOperation,
  approveOperation,
  executeOperations,
  refreshState,
} = useConnector()

const isPublishing = shallowRef(false)
const publishSuccess = shallowRef(false)
const publishError = shallowRef<string | null>(null)

const {
  data: checkResult,
  refresh: checkAvailability,
  status,
  error: checkError,
} = useAsyncData(
  (_nuxtApp, { signal }) => {
    return checkPackageName(props.packageName, { signal })
  },
  { default: () => null, immediate: false },
)

const isChecking = computed(() => {
  return status.value === 'pending'
})

const mergedError = computed(() => {
  return (
    publishError.value ??
    (checkError.value instanceof Error
      ? checkError.value.message
      : $t('claim.modal.failed_to_check'))
  )
})

const connectorModal = useModal('connector-modal')

async function handleClaim() {
  if (!checkResult.value?.available || !isConnected.value) return

  isPublishing.value = true
  publishError.value = null

  try {
    // Add the operation
    const operation = await addOperation({
      type: 'package:init',
      params: { name: props.packageName, ...(npmUser.value && { author: npmUser.value }) },
      description: `Initialize package ${props.packageName}`,
      command: `npm publish (${props.packageName}@0.0.0)`,
    })

    if (!operation) {
      throw new Error('Failed to create operation')
    }

    // Auto-approve and execute
    await approveOperation(operation.id)
    await executeOperations()

    // Refresh state and check if operation completed successfully
    await refreshState()

    // Find the operation and check its status
    const completedOp = state.value.operations.find(op => op.id === operation.id)
    if (completedOp?.status === 'completed') {
      publishSuccess.value = true
    } else if (completedOp?.status === 'failed') {
      if (completedOp.result?.requiresOtp) {
        // OTP is needed - open connector panel to handle it
        close()
        connectorModal.open()
      } else {
        publishError.value = completedOp.result?.stderr || 'Failed to publish package'
      }
    } else {
      // Still pending/approved/running - open connector panel to show progress
      close()
      connectorModal.open()
    }
  } catch (err) {
    publishError.value = err instanceof Error ? err.message : $t('claim.modal.failed_to_claim')
  } finally {
    isPublishing.value = false
  }
}

const dialogRef = ref<HTMLDialogElement>()

function open() {
  // Reset state and check availability each time modal is opened
  publishError.value = null
  publishSuccess.value = false
  checkAvailability()
  dialogRef.value?.showModal()
}

function close() {
  dialogRef.value?.close()
}

defineExpose({ open, close })

// Computed for similar packages with warnings
const hasDangerousSimilarPackages = computed(() => {
  if (!checkResult.value?.similarPackages) return false
  return checkResult.value.similarPackages.some(
    pkg => pkg.similarity === 'exact-match' || pkg.similarity === 'very-similar',
  )
})

const isScoped = computed(() => props.packageName.startsWith('@'))

// Preview of the package.json that will be published
const previewPackageJson = computed(() => {
  const access = isScoped.value ? 'public' : undefined
  return {
    name: props.packageName,
    version: '0.0.0',
    description: `Placeholder for ${props.packageName}`,
    main: 'index.js',
    scripts: {},
    keywords: [],
    author: npmUser.value ? `${npmUser.value} (https://www.npmjs.com/~${npmUser.value})` : '',
    license: 'UNLICENSED',
    private: false,
    ...(access && { publishConfig: { access } }),
  }
})
</script>

<template>
  <!-- Modal -->
  <Modal
    ref="dialogRef"
    :modalTitle="$t('claim.modal.title')"
    id="claim-package-modal"
    class="max-w-md"
  >
    <!-- Loading state -->
    <div v-if="isChecking" class="py-8 text-center">
      <LoadingSpinner :text="$t('claim.modal.checking')" />
    </div>

    <!-- Success state -->
    <div v-else-if="publishSuccess" class="space-y-4">
      <div
        class="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
      >
        <span class="i-carbon-checkmark-filled text-green-500 w-6 h-6" aria-hidden="true" />
        <div>
          <p class="font-mono text-sm text-fg">{{ $t('claim.modal.success') }}</p>
          <p class="text-xs text-fg-muted">
            {{ $t('claim.modal.success_detail', { name: packageName }) }}
          </p>
        </div>
      </div>

      <p class="text-sm text-fg-muted">
        {{ $t('claim.modal.success_hint') }}
      </p>

      <div class="flex gap-3">
        <NuxtLink
          :to="`/package/${packageName}`"
          class="flex-1 px-4 py-2 font-mono text-sm text-center text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          @click="close"
        >
          {{ $t('claim.modal.view_package') }}
        </NuxtLink>
        <button
          type="button"
          class="flex-1 px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          @click="close"
        >
          {{ $t('common.close') }}
        </button>
      </div>
    </div>

    <!-- Check result -->
    <div v-else-if="checkResult" class="space-y-4">
      <!-- Package name display -->
      <div class="p-4 bg-bg-subtle border border-border rounded-lg">
        <p class="font-mono text-lg text-fg">{{ checkResult.name }}</p>
      </div>

      <!-- Validation errors -->
      <div
        v-if="checkResult.validationErrors?.length"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
        role="alert"
      >
        <p class="font-medium mb-1">{{ $t('claim.modal.invalid_name') }}</p>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="err in checkResult.validationErrors" :key="err">{{ err }}</li>
        </ul>
      </div>

      <!-- Validation warnings -->
      <div
        v-if="checkResult.validationWarnings?.length"
        class="p-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md"
        role="alert"
      >
        <p class="font-medium mb-1">{{ $t('common.warnings') }}</p>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="warn in checkResult.validationWarnings" :key="warn">{{ warn }}</li>
        </ul>
      </div>

      <!-- Availability status -->
      <div v-if="checkResult.valid">
        <div
          v-if="checkResult.available"
          class="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
        >
          <span class="i-carbon-checkmark-filled text-green-500 w-5 h-5" aria-hidden="true" />
          <p class="font-mono text-sm text-fg">{{ $t('claim.modal.available') }}</p>
        </div>

        <div
          v-else
          class="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <span class="i-carbon-close-filled text-red-500 w-5 h-5" aria-hidden="true" />
          <p class="font-mono text-sm text-fg">{{ $t('claim.modal.taken') }}</p>
        </div>
      </div>

      <!-- Similar packages warning -->
      <div v-if="checkResult.similarPackages?.length && checkResult.available">
        <div
          :class="
            hasDangerousSimilarPackages
              ? 'bg-yellow-500/10 border-yellow-500/20'
              : 'bg-bg-subtle border-border'
          "
          class="p-4 border rounded-lg"
        >
          <p
            :class="hasDangerousSimilarPackages ? 'text-yellow-400' : 'text-fg-muted'"
            class="text-sm font-medium mb-3"
          >
            <span v-if="hasDangerousSimilarPackages">
              {{ $t('claim.modal.similar_warning') }}
            </span>
            <span v-else>{{ $t('claim.modal.related') }}</span>
          </p>
          <ul class="space-y-2">
            <li
              v-for="pkg in checkResult.similarPackages.slice(0, 5)"
              :key="pkg.name"
              class="flex items-start gap-2"
            >
              <span
                v-if="pkg.similarity === 'exact-match'"
                class="i-carbon-warning-filled text-red-500 w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span
                v-else-if="pkg.similarity === 'very-similar'"
                class="i-carbon-warning text-yellow-500 w-4 h-4 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span v-else class="w-4 h-4 shrink-0" />
              <div class="min-w-0">
                <NuxtLink
                  :to="`/package/${pkg.name}`"
                  class="font-mono text-sm text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                  target="_blank"
                >
                  {{ pkg.name }}
                </NuxtLink>
                <p v-if="pkg.description" class="text-xs text-fg-subtle truncate">
                  {{ pkg.description }}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <!-- Error message -->
      <div
        v-if="mergedError"
        role="alert"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
      >
        {{ mergedError }}
      </div>

      <!-- Actions -->
      <div v-if="checkResult.available && checkResult.valid" class="space-y-3">
        <!-- Warning for unscoped packages -->
        <div
          v-if="!isScoped"
          class="p-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md"
        >
          <p class="font-medium mb-1">{{ $t('claim.modal.scope_warning_title') }}</p>
          <p class="text-xs text-yellow-400/80">
            {{
              $t('claim.modal.scope_warning_text', {
                username: npmUser || 'username',
                name: packageName,
              })
            }}
          </p>
        </div>

        <!-- Not connected warning -->
        <div v-if="!isConnected" class="space-y-3">
          <div
            class="p-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md"
          >
            <p>{{ $t('claim.modal.connect_required') }}</p>
          </div>
          <button
            type="button"
            class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            @click="connectorModal.open"
          >
            {{ $t('claim.modal.connect_button') }}
          </button>
        </div>

        <!-- Claim button -->
        <div v-else class="space-y-3">
          <p class="text-sm text-fg-muted">
            {{ $t('claim.modal.publish_hint') }}
          </p>

          <!-- Expandable package.json preview -->
          <details class="border border-border rounded-md overflow-hidden">
            <summary
              class="px-3 py-2 text-sm text-fg-muted bg-bg-subtle cursor-pointer hover:text-fg transition-colors select-none"
            >
              {{ $t('claim.modal.preview_json') }}
            </summary>
            <pre class="p-3 text-xs font-mono text-fg-muted bg-bg-muted overflow-x-auto">{{
              JSON.stringify(previewPackageJson, null, 2)
            }}</pre>
          </details>

          <button
            type="button"
            :disabled="isPublishing"
            class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            @click="handleClaim"
          >
            {{ isPublishing ? $t('claim.modal.publishing') : $t('claim.modal.claim_button') }}
          </button>
        </div>
      </div>

      <!-- Close button for unavailable/invalid -->
      <button
        v-if="!checkResult.available || !checkResult.valid"
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="close"
      >
        {{ $t('common.close') }}
      </button>
    </div>

    <!-- Error state -->
    <div v-else-if="mergedError" class="space-y-4">
      <div
        role="alert"
        class="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md"
      >
        {{ mergedError }}
      </div>
      <button
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="() => checkAvailability()"
      >
        {{ $t('common.retry') }}
      </button>
    </div>
  </Modal>
</template>
