<script setup lang="ts">
import { useAtproto } from '~/composables/atproto/useAtproto'
import { useModal } from '~/composables/useModal'
import type { MenuDropdownItem } from '~/types'

const {
  isConnected: isNpmConnected,
  isConnecting: isNpmConnecting,
  npmUser,
  avatar: npmAvatar,
  activeOperations,
  hasPendingOperations,
} = useConnector()

const { user: atprotoUser } = useAtproto()

/** Check if connected to at least one service */
const hasAnyConnection = computed(() => isNpmConnected.value || !!atprotoUser.value)

/** Check if connected to both services */
const hasBothConnections = computed(() => isNpmConnected.value && !!atprotoUser.value)

/** Only show count of active (pending/approved/running) operations */
const operationCount = computed(() => activeOperations.value.length)

const connectorModal = useModal('connector-modal')

function openConnectorModal() {
  connectorModal?.open()
}

const authModal = useModal('auth-modal')

function openAuthModal() {
  authModal?.open()
}

const items = computed<MenuDropdownItem[]>(() => [
  isNpmConnected.value && npmUser.value
    ? {
        type: 'action',
        icon: 'i-lucide:terminal',
        title: `~${npmUser.value}`,
        description:
          operationCount.value > 0
            ? $t('account_menu.ops', { count: operationCount.value })
            : $t('account_menu.npm_cli'),
        handler: openConnectorModal,
      }
    : {
        type: 'action',
        icon: 'i-lucide:terminal',
        title: isNpmConnecting.value
          ? $t('account_menu.connecting')
          : $t('account_menu.connect_npm_cli'),
        description: $t('account_menu.npm_cli_desc'),
        handler: openConnectorModal,
      },
  atprotoUser.value
    ? {
        type: 'action',
        icon: 'i-lucide:at-sign',
        title: `@${atprotoUser.value.handle}`,
        description: $t('account_menu.atmosphere'),
        handler: openAuthModal,
      }
    : {
        type: 'action',
        icon: 'i-lucide:at-sign',
        title: $t('account_menu.connect_atmosphere'),
        description: $t('account_menu.atmosphere_desc'),
        handler: openAuthModal,
      },
])
</script>

<template>
  <MenuDropdown :items="items" class="min-w-28 flex justify-end">
    <template #trigger="{ open, toggle }">
      <ButtonBase
        type="button"
        :aria-expanded="open"
        aria-haspopup="true"
        class="py-1.75! border-none"
        @click="toggle"
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
        <span v-if="!hasAnyConnection" class="font-mono text-sm">
          {{ $t('account_menu.connect') }}
        </span>

        <!-- Chevron -->
        <span
          class="i-lucide:chevron-down w-3 h-3 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
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
    </template>
  </MenuDropdown>

  <HeaderConnectorModal />
  <HeaderAuthModal />
</template>
