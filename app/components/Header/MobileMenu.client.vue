<script setup lang="ts">
import { useFocusTrap } from '@vueuse/integrations/useFocusTrap'
import { useAtproto } from '~/composables/atproto/useAtproto'

const isOpen = defineModel<boolean>('open', { default: false })

const { isConnected, npmUser, avatar: npmAvatar } = useConnector()
const { user: atprotoUser } = useAtproto()

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
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[60] sm:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('nav.mobile_menu')"
      >
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          :aria-label="$t('common.close')"
          @click="closeMenu"
        />

        <!-- Menu panel (slides in from right) -->
        <Transition
          enter-active-class="transition-transform duration-200"
          enter-from-class="translate-x-full"
          enter-to-class="translate-x-0"
          leave-active-class="transition-transform duration-200"
          leave-from-class="translate-x-0"
          leave-to-class="translate-x-full"
        >
          <nav
            v-if="isOpen"
            ref="navRef"
            class="absolute inset-ie-0 top-0 bottom-0 w-72 bg-bg border-is border-border shadow-xl flex flex-col"
          >
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-border">
              <span class="font-mono text-sm text-fg-muted">{{ $t('nav.menu') }}</span>
              <button
                type="button"
                class="p-2 -m-2 text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-accent/70 rounded"
                :aria-label="$t('common.close')"
                @click="closeMenu"
              >
                <span class="i-carbon:close w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <!-- Navigation links -->
            <div class="flex-1 overflow-y-auto overscroll-contain py-2">
              <!-- Main navigation -->
              <div class="px-2 py-2">
                <NuxtLink
                  to="/about"
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                  @click="closeMenu"
                >
                  <span class="i-carbon:information w-5 h-5 text-fg-muted" aria-hidden="true" />
                  {{ $t('footer.about') }}
                </NuxtLink>

                <NuxtLink
                  to="/compare"
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                  @click="closeMenu"
                >
                  <span class="i-carbon:compare w-5 h-5 text-fg-muted" aria-hidden="true" />
                  {{ $t('nav.compare') }}
                </NuxtLink>

                <NuxtLink
                  to="/settings"
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                  @click="closeMenu"
                >
                  <span class="i-carbon:settings w-5 h-5 text-fg-muted" aria-hidden="true" />
                  {{ $t('nav.settings') }}
                </NuxtLink>

                <!-- Connected user links -->
                <template v-if="isConnected && npmUser">
                  <NuxtLink
                    :to="`/~${npmUser}`"
                    class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                    @click="closeMenu"
                  >
                    <span class="i-carbon:package w-5 h-5 text-fg-muted" aria-hidden="true" />
                    {{ $t('header.packages') }}
                  </NuxtLink>

                  <NuxtLink
                    :to="`/~${npmUser}/orgs`"
                    class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                    @click="closeMenu"
                  >
                    <span class="i-carbon:enterprise w-5 h-5 text-fg-muted" aria-hidden="true" />
                    {{ $t('header.orgs') }}
                  </NuxtLink>
                </template>
              </div>

              <!-- Divider -->
              <div class="mx-4 my-2 border-t border-border" />

              <!-- External links (from footer) -->
              <div class="px-2 py-2">
                <span class="px-3 py-2 font-mono text-xs text-fg-subtle uppercase tracking-wider">
                  {{ $t('nav.links') }}
                </span>

                <a
                  href="https://docs.npmx.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
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
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
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
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
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
                  class="flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200"
                >
                  <span class="i-carbon:chat w-5 h-5 text-fg-muted" aria-hidden="true" />
                  {{ $t('footer.chat') }}
                  <span
                    class="i-carbon:launch rtl-flip w-3 h-3 ms-auto text-fg-subtle"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>

            <!-- Divider -->
            <div class="mx-4 my-2 border-t border-border" />

            <!-- Account section -->
            <div class="px-2 py-2">
              <span
                class="px-3 py-2 block font-mono text-xs text-fg-subtle uppercase tracking-wider"
              >
                {{ $t('account_menu.account') }}
              </span>

              <!-- npm CLI connection status (only show if connected) -->
              <button
                v-if="isConnected && npmUser"
                type="button"
                class="w-full flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
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
                class="w-full flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
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
                class="w-full flex items-center gap-3 px-3 py-3 rounded-md font-mono text-sm text-fg hover:bg-bg-subtle transition-colors duration-200 text-start"
                @click="handleShowAuth"
              >
                <span class="w-5 h-5 rounded-full bg-bg-muted flex items-center justify-center">
                  <span class="i-carbon-cloud w-3 h-3 text-fg-muted" aria-hidden="true" />
                </span>
                <span class="flex-1">{{ $t('account_menu.connect_atmosphere') }}</span>
              </button>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-border mt-auto">
              <p class="font-mono text-xs text-fg-subtle text-center">
                {{ $t('non_affiliation_disclaimer') }}
              </p>
            </div>
          </nav>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
