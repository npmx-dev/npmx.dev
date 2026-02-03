<script setup lang="ts">
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'

const isOpen = defineModel<boolean>('open', { default: false })

const { isConnected, npmUser, avatar: npmAvatar } = useConnector()
const { user: atprotoUser } = useAtproto()
const { backgroundThemes, setBackgroundTheme, selectedBackgroundTheme } = useBackgroundTheme()

const navRef = useTemplateRef('navRef')
const { activate, deactivate } = useFocusTrap(navRef, { allowOutsideClick: true })

function closeMenu() {
  isOpen.value = false
}

function handleShowConnector() {
  const connectorModal = document.querySelector<HTMLDialogElement>('#connector-modal')
  if (connectorModal) {
    closeMenu()
    connectorModal.showModal()
  }
}

function handleShowAuth() {
  const authModal = document.querySelector<HTMLDialogElement>('#auth-modal')
  if (authModal) {
    closeMenu()
    authModal.showModal()
  }
}

function cycleTheme() {
  const currentIndex = backgroundThemes.findIndex(t => t.id === selectedBackgroundTheme.value)
  const nextIndex = (currentIndex + 1) % backgroundThemes.length
  setBackgroundTheme(backgroundThemes[nextIndex].id)
}

function handleSearch() {
  closeMenu()
  navigateTo('/search')
}

function handleSettings() {
  closeMenu()
  navigateTo('/settings')
}

// Close menu on route change
const route = useRoute()
watch(() => route.fullPath, closeMenu)

// Close on escape
onKeyStroke(
  e => isKeyWithoutModifiers(e, 'Escape') && isOpen.value,
  e => {
    isOpen.value = false
  },
)

// Prevent body scroll when menu is open
const isLocked = useScrollLock(document)
watch(isOpen, open => (isLocked.value = open))
watch(isOpen, open => (open ? nextTick(activate) : deactivate()))
onUnmounted(deactivate)
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-full"
      enter-to-class="opacity-100 translate-y-0"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-full"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 sm:hidden flex flex-col bg-bg"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('nav.mobile_menu')"
        ref="navRef"
      >
        <!-- Navigation links -->
        <div class="flex-1 overflow-y-auto overscroll-contain py-4">
          <!-- Main navigation -->
          <div class="px-4 space-y-2">
            <NuxtLink
              to="/about"
              class="flex items-center gap-4 px-4 py-4 rounded-xl font-mono text-lg text-fg hover:bg-bg-subtle transition-colors duration-200"
              @click="closeMenu"
            >
              <span class="i-carbon:information w-6 h-6 text-fg-muted" aria-hidden="true" />
              {{ $t('footer.about') }}
            </NuxtLink>

            <NuxtLink
              to="/compare"
              class="flex items-center gap-4 px-4 py-4 rounded-xl font-mono text-lg text-fg hover:bg-bg-subtle transition-colors duration-200"
              @click="closeMenu"
            >
              <span class="i-carbon:compare w-6 h-6 text-fg-muted" aria-hidden="true" />
              {{ $t('nav.compare') }}
            </NuxtLink>

            <NuxtLink
              to="/settings"
              class="flex items-center gap-4 px-4 py-4 rounded-xl font-mono text-lg text-fg hover:bg-bg-subtle transition-colors duration-200"
              @click="closeMenu"
            >
              <span class="i-carbon:settings w-6 h-6 text-fg-muted" aria-hidden="true" />
              {{ $t('nav.settings') }}
            </NuxtLink>

            <!-- Connected user links -->
            <template v-if="isConnected && npmUser">
              <NuxtLink
                :to="`/~${npmUser}`"
                class="flex items-center gap-4 px-4 py-4 rounded-xl font-mono text-lg text-fg hover:bg-bg-subtle transition-colors duration-200"
                @click="closeMenu"
              >
                <span class="i-carbon:package w-6 h-6 text-fg-muted" aria-hidden="true" />
                {{ $t('header.packages') }}
              </NuxtLink>

              <NuxtLink
                :to="`/~${npmUser}/orgs`"
                class="flex items-center gap-4 px-4 py-4 rounded-xl font-mono text-lg text-fg hover:bg-bg-subtle transition-colors duration-200"
                @click="closeMenu"
              >
                <span class="i-carbon:enterprise w-6 h-6 text-fg-muted" aria-hidden="true" />
                {{ $t('header.orgs') }}
              </NuxtLink>
            </template>
          </div>

          <!-- Divider -->
          <div class="mx-6 my-4 border-t border-border" />

          <!-- External links (from footer) -->
          <div class="px-4 space-y-2">
            <span class="px-4 py-2 block font-mono text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('nav.links') }}
            </span>

            <a
              href="https://docs.npmx.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200"
            >
              <span class="i-carbon:document w-5 h-5 text-fg-muted" aria-hidden="true" />
              {{ $t('footer.docs') }}
              <span
                class="i-carbon:launch rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                aria-hidden="true"
              />
            </a>

            <a
              href="https://repo.npmx.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200"
            >
              <span class="i-carbon:logo-github w-5 h-5 text-fg-muted" aria-hidden="true" />
              {{ $t('footer.source') }}
              <span
                class="i-carbon:launch rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                aria-hidden="true"
              />
            </a>

            <a
              href="https://social.npmx.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200"
            >
              <span class="i-simple-icons:bluesky w-5 h-5 text-fg-muted" aria-hidden="true" />
              {{ $t('footer.social') }}
              <span
                class="i-carbon:launch rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                aria-hidden="true"
              />
            </a>

            <a
              href="https://chat.npmx.dev"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200"
            >
              <span class="i-carbon:chat w-5 h-5 text-fg-muted" aria-hidden="true" />
              {{ $t('footer.chat') }}
              <span
                class="i-carbon:launch rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                aria-hidden="true"
              />
            </a>
          </div>

          <!-- Divider -->
          <div class="mx-6 my-4 border-t border-border" />

          <!-- Account section -->
          <div class="px-4 space-y-2 pb-20">
            <span class="px-4 py-2 block font-mono text-xs text-fg-subtle uppercase tracking-wider">
              {{ $t('account_menu.account') }}
            </span>

            <!-- npm CLI connection status (only show if connected) -->
            <button
              v-if="isConnected && npmUser"
              type="button"
              class="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
              @click="handleShowConnector"
            >
              <img
                v-if="npmAvatar"
                :src="npmAvatar"
                :alt="npmUser"
                width="20"
                height="20"
                class="w-5 h-5 rounded-full"
              />
              <span
                v-else
                class="w-5 h-5 rounded-full bg-bg-muted flex items-center justify-center"
              >
                <span class="i-carbon-terminal w-3 h-3 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1">~{{ npmUser }}</span>
              <span class="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
            </button>

            <!-- Atmosphere connection status -->
            <button
              v-if="atprotoUser"
              type="button"
              class="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
              @click="handleShowAuth"
            >
              <span class="w-5 h-5 rounded-full bg-bg-muted flex items-center justify-center">
                <span class="i-carbon-cloud w-3 h-3 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1 truncate">@{{ atprotoUser.handle }}</span>
            </button>

            <!-- Connect Atmosphere button (show if not connected) -->
            <button
              v-else
              type="button"
              class="w-full flex items-center gap-4 px-4 py-3 rounded-xl font-mono text-base text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
              @click="handleShowAuth"
            >
              <span class="w-5 h-5 rounded-full bg-bg-muted flex items-center justify-center">
                <span class="i-carbon-cloud w-3 h-3 text-fg-muted" aria-hidden="true" />
              </span>
              <span class="flex-1">{{ $t('account_menu.connect_atmosphere') }}</span>
            </button>
          </div>
        </div>

        <!-- Bottom Toolbar -->
        <div
          class="flex-none flex items-center justify-between px-6 py-4 border-t border-border bg-bg/95 backdrop-blur safe-area-bottom"
        >
          <!-- Search -->
          <button
            type="button"
            class="flex flex-col items-center gap-1 text-fg-subtle hover:text-fg transition-colors"
            @click="handleSearch"
          >
            <span class="i-carbon:search w-6 h-6" />
            <span class="text-xs font-mono">{{ $t('nav.search') }}</span>
          </button>

          <!-- Text/Font (Settings) -->
          <button
            type="button"
            class="flex flex-col items-center gap-1 text-fg-subtle hover:text-fg transition-colors"
            @click="handleSettings"
          >
            <span class="i-carbon:text-font w-6 h-6" />
            <span class="text-xs font-mono">{{ $t('nav.settings') }}</span>
          </button>

          <!-- Theme -->
          <button
            type="button"
            class="flex flex-col items-center gap-1 text-fg-subtle hover:text-fg transition-colors"
            @click="cycleTheme"
          >
            <span class="i-carbon:color-palette w-6 h-6" />
            <span class="text-xs font-mono">{{ $t('settings.theme') }}</span>
          </button>

          <!-- Close -->
          <button
            type="button"
            class="flex flex-col items-center gap-1 text-fg-subtle hover:text-fg transition-colors"
            @click="closeMenu"
          >
            <span class="i-carbon:close w-6 h-6" />
            <span class="text-xs font-mono">{{ $t('common.close') }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
