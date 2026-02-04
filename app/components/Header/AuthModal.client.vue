<script setup lang="ts">
import { useAtproto } from '~/composables/atproto/useAtproto'
import { authRedirect } from '~/utils/atproto/helpers'

const handleInput = shallowRef('')

const { user, logout } = useAtproto()

async function handleBlueskySignIn() {
  await authRedirect('https://bsky.social')
}

async function handleCreateAccount() {
  await authRedirect('https://npmx.social', true)
}

async function handleLogin() {
  if (handleInput.value) {
    await authRedirect(handleInput.value)
  }
}
</script>

<template>
  <!-- Modal -->
  <Modal :modalTitle="$t('auth.modal.title')" class="max-w-lg" id="auth-modal">
    <div v-if="user?.handle" class="space-y-4">
      <div class="flex items-center gap-3 p-4 bg-bg-subtle border border-border rounded-lg">
        <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
        <div>
          <p class="font-mono text-xs text-fg-muted">
            {{ $t('auth.modal.connected_as', { handle: user.handle }) }}
          </p>
        </div>
      </div>
      <button
        class="w-full px-4 py-2 font-mono text-sm text-fg-muted bg-bg-subtle border border-border rounded-md transition-colors duration-200 hover:text-fg hover:border-border-hover focus-visible:outline-accent/70"
        @click="logout"
      >
        {{ $t('auth.modal.disconnect') }}
      </button>
    </div>

    <!-- Disconnected state -->
    <form v-else class="space-y-4" @submit.prevent="handleLogin">
      <p class="text-sm text-fg-muted">{{ $t('auth.modal.connect_prompt') }}</p>

      <div class="space-y-3">
        <div>
          <label
            for="handle-input"
            class="block text-xs text-fg-subtle uppercase tracking-wider mb-1.5"
          >
            {{ $t('auth.modal.handle_label') }}
          </label>
          <input
            id="handle-input"
            v-model="handleInput"
            type="text"
            name="handle"
            :placeholder="$t('auth.modal.handle_placeholder')"
            autocomplete="off"
            spellcheck="false"
            class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-accent focus-visible:(outline-2 outline-accent/70)"
          />
        </div>

        <details class="text-sm">
          <summary
            class="text-fg-subtle cursor-pointer hover:text-fg-muted transition-colors duration-200 focus-visible:(outline-2 outline-accent/70)"
          >
            {{ $t('auth.modal.what_is_atmosphere') }}
          </summary>
          <div class="mt-3">
            <i18n-t keypath="auth.modal.atmosphere_explanation" tag="p" scope="global">
              <template #npmx>
                <span class="font-bold">npmx.dev</span>
              </template>
              <template #atproto>
                <a href="https://atproto.com" target="_blank" class="text-blue-400 hover:underline">
                  AT Protocol
                </a>
              </template>
              <template #bluesky>
                <a href="https://bsky.app" target="_blank" class="text-blue-400 hover:underline">
                  Bluesky
                </a>
              </template>
              <template #tangled>
                <a href="https://tangled.org" target="_blank" class="text-blue-400 hover:underline">
                  Tangled
                </a>
              </template>
            </i18n-t>
          </div>
        </details>
      </div>

      <button
        type="submit"
        :disabled="!handleInput.trim()"
        class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {{ $t('auth.modal.connect') }}
      </button>
      <button
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        @click="handleCreateAccount"
      >
        {{ $t('auth.modal.create_account') }}
      </button>
      <hr class="color-border" />
      <button
        type="button"
        class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg flex items-center justify-center gap-2"
        @click="handleBlueskySignIn"
      >
        {{ $t('auth.modal.connect_bluesky') }}
        <svg fill="none" viewBox="0 0 64 57" width="20" style="width: 20px">
          <path
            fill="#0F73FF"
            d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"
          ></path>
        </svg>
      </button>
    </form>
  </Modal>
</template>
