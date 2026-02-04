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
  <div ref="accountMenuRef" class="relative flex min-w-24 justify-end">
    <button
      type="button"
      class="relative flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors duration-200 hover:bg-bg-subtle hover:text-accent focus-visible:outline-accent/70"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      @click="isOpen = !isOpen"
    >
      <!-- Stacked avatars when connected -->
      <div
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
          class="w-6 h-6 rounded-full ring-2 ring-bg"
        />
        <span
          v-else-if="isNpmConnected"
          class="w-6 h-6 rounded-full bg-bg-muted ring-2 ring-bg flex items-center justify-center"
        >
          <span class="i-carbon-terminal w-3 h-3 text-fg-muted" aria-hidden="true" />
        </span>

        <!-- Atmosphere avatar (second/front, overlapping) -->
        <span
          v-if="atprotoUser"
          class="w-6 h-6 rounded-full bg-bg-muted ring-2 ring-bg flex items-center justify-center"
          :class="hasBothConnections ? 'relative z-10' : ''"
        >
          <span class="i-carbon-cloud w-3 h-3 text-fg-muted" aria-hidden="true" />
        </span>
      </div>

      <!-- "connect" text when not connected -->
      <span v-if="!hasAnyConnection" class="font-mono text-sm">
        {{ $t('account_menu.connect') }}
      </span>

      <!-- Chevron -->
      <span
        class="i-carbon-chevron-down w-3 h-3 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />

      <!-- Operation count badge (when npm connected with pending ops) -->
      <span
        v-if="isNpmConnected && operationCount > 0"
        class="absolute -top-1 -inset-ie-1 min-w-[1rem] h-4 px-1 flex items-center justify-center font-mono text-[10px] rounded-full"
        :class="hasPendingOperations ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'"
        aria-hidden="true"
      >
        {{ operationCount }}
      </span>
    </button>

    <!-- Dropdown menu -->
    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isOpen" class="absolute inset-ie-0 top-full pt-2 w-72 z-50" role="menu">
        <div class="bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden px-1">
          <!-- Connected accounts section -->
          <div v-if="hasAnyConnection" class="py-1">
            <!-- npm CLI connection -->
            <button
              v-if="isNpmConnected && npmUser"
              type="button"
              role="menuitem"
              class="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bg-subtle transition-colors text-start"
              @click="openConnectorModal"
            >
              <img
                v-if="npmAvatar"
                :src="npmAvatar"
                :alt="npmUser"
                width="32"
                height="32"
                class="w-8 h-8 rounded-full"
              />
              <span
                v-else
                class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center"
              >
                <span class="i-carbon-terminal w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm text-fg truncate">~{{ npmUser }}</div>
                <div class="text-xs text-fg-subtle">{{ $t('account_menu.npm_cli') }}</div>
              </div>
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
            </button>

            <!-- Atmosphere connection -->
            <button
              v-if="atprotoUser"
              type="button"
              role="menuitem"
              class="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bg-subtle transition-colors text-start"
              @click="openAuthModal"
            >
              <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
                <span class="i-carbon-cloud w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm text-fg truncate">@{{ atprotoUser.handle }}</div>
                <div class="text-xs text-fg-subtle">{{ $t('account_menu.atmosphere') }}</div>
              </div>
            </button>
          </div>

          <!-- Divider (only if we have connections AND options to connect) -->
          <div
            v-if="hasAnyConnection && (!isNpmConnected || !atprotoUser)"
            class="border-t border-border"
          />

          <!-- Connect options -->
          <div v-if="!isNpmConnected || !atprotoUser" class="py-1">
            <button
              v-if="!isNpmConnected"
              type="button"
              role="menuitem"
              class="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bg-subtle transition-colors text-start rounded-md"
              @click="openConnectorModal"
            >
              <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
                <span
                  v-if="isNpmConnecting"
                  class="i-carbon-circle-dash w-4 h-4 text-yellow-500 animate-spin"
                  aria-hidden="true"
                />
                <span v-else class="i-carbon-terminal w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm text-fg">
                  {{
                    isNpmConnecting
                      ? $t('account_menu.connecting')
                      : $t('account_menu.connect_npm_cli')
                  }}
                </div>
                <div class="text-xs text-fg-subtle">{{ $t('account_menu.npm_cli_desc') }}</div>
              </div>
            </button>

            <button
              v-if="!atprotoUser"
              type="button"
              role="menuitem"
              class="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bg-subtle transition-colors text-start rounded-md"
              @click="openAuthModal"
            >
              <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
                <span class="i-carbon-cloud w-4 h-4 text-fg-muted" aria-hidden="true" />
              </span>
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm text-fg">
                  {{ $t('account_menu.connect_atmosphere') }}
                </div>
                <div class="text-xs text-fg-subtle">{{ $t('account_menu.atmosphere_desc') }}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
  <HeaderConnectorModal />
  <HeaderAuthModal />
</template>
