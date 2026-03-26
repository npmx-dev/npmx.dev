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

const menuButtonRef = useTemplateRef('menuButtonRef')
const menuRef = useTemplateRef('menuRef')

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
    menuButtonRef.value?.focus()
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

watch(menuRef, () => {
  if (!menuRef.value) return
  // Set up focus for the first menu item
  const firstMenuItem = menuRef.value.querySelector('[role="menuitem"]') as HTMLButtonElement
  if (!firstMenuItem) {
    throw new Error('Cannot find a menuitem to focus')
  }
  firstMenuItem.tabIndex = 0
  firstMenuItem.focus()
})

const menuItemNavKeys = {
  next: 'ArrowDown',
  prev: 'ArrowUp',
  start: 'Home',
  end: 'End',
}

function onMenuBlurWithin() {
  requestAnimationFrame(() => {
    if (!menuRef.value?.contains(document.activeElement)) {
      isOpen.value = false
    }
  })
}

/**
 * Use a roving tabindex for the menu widget
 */
function onMenuKeyDown(event: KeyboardEvent) {
  const menu = event.currentTarget as HTMLElement
  if (!menu) return

  // Collect the menu items (i.e. focusable candidates)
  const menuItems: HTMLElement[] = Array.from(menu.querySelectorAll('[role="menuitem"]'))
  // Find the current item
  let currentIndex = menuItems.findIndex(menuItem => menuItem.tabIndex !== -1)
  const currentMenuItem = menuItems.at(currentIndex)
  if (!currentMenuItem) {
    throw new Error(`Missing menuitem at index ${currentIndex}`)
  }

  switch (event.key) {
    case menuItemNavKeys.prev:
      currentIndex = mod(currentIndex - 1, menuItems.length)
      break
    case menuItemNavKeys.next:
      currentIndex = mod(currentIndex + 1, menuItems.length)
      break
    case menuItemNavKeys.start:
      currentIndex = 0
      break
    case menuItemNavKeys.end:
      currentIndex = menuItems.length - 1
      break
    default:
      // Ignore all other keys
      return
  }

  const menuItemToFocus = menuItems.at(currentIndex)
  if (!menuItemToFocus) {
    throw new RangeError(`currentIndex (${currentIndex}) outside of range of menu items`)
  }

  event.preventDefault()

  currentMenuItem.tabIndex = -1
  menuItemToFocus.tabIndex = 0
  menuItemToFocus.focus()
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}
</script>

<template>
  <div ref="accountMenuRef" class="relative flex min-w-28 justify-end">
    <ButtonBase
      ref="menuButtonRef"
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      @click="isOpen = !isOpen"
      class="border-none"
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
      <div
        v-if="isOpen"
        class="absolute inset-ie-0 top-full pt-2 w-72 z-50"
        ref="menuRef"
        role="menu"
        @blur.capture="onMenuBlurWithin"
        @keydown="onMenuKeyDown"
      >
        <div
          class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden px-1"
        >
          <!-- Connected accounts section -->
          <div v-if="hasAnyConnection" class="py-1">
            <!-- npm CLI connection -->
            <ButtonBase
              v-if="isNpmConnected && npmUser"
              role="menuitem"
              tabindex="-1"
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
              tabindex="-1"
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
              tabindex="-1"
              class="w-full text-start gap-x-3 border-none"
              @click="openConnectorModal"
            >
              <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
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
              tabindex="-1"
              class="w-full text-start gap-x-3 border-none"
              @click="openAuthModal"
            >
              <span class="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center">
                <span class="i-lucide:at-sign w-4 h-4 text-fg-muted" aria-hidden="true" />
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
