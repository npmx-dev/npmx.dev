<script setup lang="ts">
import { useAtproto } from '~/composables/atproto/useAtproto'
import { useModal } from '~/composables/useModal'

const {
  isConnected: isNpmConnected,
  isConnecting: isNpmConnecting,
  npmUser,
  avatar: npmAvatar,
  activeOperations,
  hasPendingOperations,
} = useConnector()

const { user: atprotoUser } = useAtproto()

const isOpen = shallowRef(false)

/** Check if connected to at least one service */
const hasAnyConnection = computed(() => isNpmConnected.value || !!atprotoUser.value)

/** Check if connected to both services */
const hasBothConnections = computed(() => isNpmConnected.value && !!atprotoUser.value)

/** Only show count of active (pending/approved/running) operations */
const operationCount = computed(() => activeOperations.value.length)

const accountMenuRef = useTemplateRef('accountMenuRef')

onClickOutside(accountMenuRef, () => {
  isOpen.value = false
})

useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
})

const connectorModal = useModal('connector-modal')

function openConnectorModal() {
  if (connectorModal) {
    isOpen.value = false
    connectorModal.open()
  }
}

const authModal = useModal('auth-modal')

function openAuthModal() {
  if (authModal) {
    isOpen.value = false
    authModal.open()
  }
}
</script>

<template>
  <div ref="accountMenuRef">
    <ButtonBase
      type="button"
      class="border-0 min-w-28"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="isOpen = !isOpen"
    >
      <!-- Stacked avatars when connected -->
      <span
        v-if="hasAnyConnection"
        class="flex items-center"
        :class="hasBothConnections ? '-space-x-2' : ''"
      >
        <!-- npm avatar (first/back) -->
        <img
          v-if="isNpmConnected && npmAvatar"
          :src="npmAvatar"
          :alt="npmUser || $t('account_menu.npm_cli')"
          width="24"
          height="24"
          class="w-6 h-6 rounded-full ring-2 ring-bg object-cover"
        />
        <span
          v-else-if="isNpmConnected"
          class="w-6 h-6 rounded-full bg-bg-muted ring-2 ring-bg flex items-center justify-center"
        >
          <span class="i-lucide:terminal w-3 h-3 text-fg-muted" aria-hidden="true" />
        </span>

        <!-- Atmosphere avatar (second/front, overlapping) -->
        <img
          v-if="atprotoUser?.avatar"
          :src="atprotoUser.avatar"
          :alt="atprotoUser.handle"
          width="24"
          height="24"
          class="w-6 h-6 rounded-full ring-2 ring-bg object-cover"
          :class="hasBothConnections ? 'relative z-10' : ''"
        />
        <span
          v-else-if="atprotoUser"
          class="w-6 h-6 rounded-full bg-bg-muted ring-2 ring-bg flex items-center justify-center"
          :class="hasBothConnections ? 'relative z-10' : ''"
        >
          <span class="i-lucide:at-sign w-3 h-3 text-fg-muted" aria-hidden="true" />
        </span>
      </span>

      <!-- "connect" text when not connected -->
      <span v-if="!hasAnyConnection" class="text-sm">
        {{ $t('account_menu.connect') }}
      </span>

      <!-- Chevron -->
      <span
        class="i-lucide:chevron-down w-3 h-3 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />

      <!-- Operation count badge (when npm connected with pending ops) -->
      <span
        v-if="isNpmConnected && operationCount > 0"
        class="absolute -top-1 -inset-ie-1 min-w-[1rem] h-4 px-1 flex items-center justify-center font-mono text-3xs rounded-full"
        :class="hasPendingOperations ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'"
        aria-hidden="true"
      >
        {{ operationCount }}
      </span>
    </ButtonBase>

    <!-- Dropdown menu -->
    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isOpen" class="absolute inset-ie-0 top-full pt-2 w-72 z-50" role="menu">
        <div
          class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/10 overflow-hidden px-1"
        >
          <!-- Connected accounts section -->
          <div v-if="hasAnyConnection" class="py-1">
            <!-- npm CLI connection -->
            <ButtonBase
              v-if="isNpmConnected && npmUser"
              role="menuitem"
              class="w-full text-start gap-x-3 border-none"
              @click="openConnectorModal"
              out
            >
              <img
                v-if="npmAvatar"
                :src="npmAvatar"
                :alt="npmUser"
                width="32"
                height="32"
                class="w-8 h-8 rounded-full object-cover"
              />
              <span
                v-else
                class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center"
              >
                <span class="i-lucide:terminal w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="font-mono text-sm text-fg truncate block">~{{ npmUser }}</span>
                <span class="text-xs text-fg-subtle">{{ $t('account_menu.npm_cli') }}</span>
              </span>
              <span
                v-if="operationCount > 0"
                class="px-1.5 py-0.5 font-mono text-xs rounded"
                :class="
                  hasPendingOperations
                    ? 'bg-yellow-500/20 text-yellow-600'
                    : 'bg-blue-500/20 text-blue-500'
                "
              >
                {{
                  $t('account_menu.ops', {
                    count: operationCount,
                  })
                }}
              </span>
            </ButtonBase>

            <!-- Atmosphere connection -->
            <ButtonBase
              v-if="atprotoUser"
              role="menuitem"
              class="w-full text-start gap-x-3 border-none"
              @click="openAuthModal"
            >
              <img
                v-if="atprotoUser.avatar"
                :src="atprotoUser.avatar"
                :alt="atprotoUser.handle"
                width="32"
                height="32"
                class="w-8 h-8 rounded-full object-cover"
              />
              <span
                v-else
                class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center"
              >
                <span class="i-lucide:at-sign w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="font-mono text-sm text-fg truncate block"
                  >@{{ atprotoUser.handle }}</span
                >
                <span class="text-xs text-fg-subtle">{{ $t('account_menu.atmosphere') }}</span>
              </span>
            </ButtonBase>
          </div>

          <!-- Divider (only if we have connections AND options to connect) -->
          <div
            v-if="hasAnyConnection && (!isNpmConnected || !atprotoUser)"
            class="border-t border-border"
          />

          <!-- Connect options -->
          <div v-if="!isNpmConnected || !atprotoUser" class="py-1">
            <ButtonBase
              v-if="!isNpmConnected"
              role="menuitem"
              class="w-full text-start gap-x-3 border-none"
              @click="openConnectorModal"
            >
              <span
                class="w-8 h-8 rounded-full bg-bg-muted group-hover:bg-bg-subtle flex items-center justify-center"
              >
                <span
                  v-if="isNpmConnecting"
                  class="i-svg-spinners:ring-resize w-4 h-4 text-yellow-500 animate-spin"
                  aria-hidden="true"
                />
                <span v-else class="i-lucide:terminal w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="font-mono text-sm text-fg block">
                  {{
                    isNpmConnecting
                      ? $t('account_menu.connecting')
                      : $t('account_menu.connect_npm_cli')
                  }}
                </span>
                <span class="text-xs text-fg-subtle">{{ $t('account_menu.npm_cli_desc') }}</span>
              </span>
            </ButtonBase>

            <ButtonBase
              v-if="!atprotoUser"
              role="menuitem"
              class="w-full text-start gap-x-3 border-none"
              @click="openAuthModal"
            >
              <span
                class="w-8 h-8 rounded-full bg-bg-muted group-hover:bg-bg-subtle flex items-center justify-center"
              >
                <span class="i-carbon-cloud w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="font-mono text-sm text-fg block">
                  {{ $t('account_menu.connect_atmosphere') }}
                </span>
                <span class="text-xs text-fg-subtle">{{ $t('account_menu.atmosphere_desc') }}</span>
              </span>
            </ButtonBase>
          </div>
        </div>
      </div>
    </Transition>
  </div>
  <HeaderConnectorModal />
  <HeaderAuthModal />
</template>
