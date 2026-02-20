<script setup lang="ts">
import { useAtproto } from '~/composables/atproto/useAtproto'
import { authRedirect } from '~/utils/atproto/helpers'
import { isAtIdentifierString } from '@atproto/lex'

const handleInput = shallowRef('')
const errorMessage = shallowRef('')
const route = useRoute()
const { user, logout } = useAtproto()

// https://atproto.com supports 4 locales as of 2026-02-07
const { locale } = useI18n()
const currentLang = locale.value.split('-')[0] ?? 'en'
const localeSubPath = ['ko', 'pt', 'ja'].includes(currentLang) ? currentLang : ''
const atprotoLink = `https://atproto.com/${localeSubPath}`

async function handleBlueskySignIn() {
  await authRedirect('https://bsky.social', { redirectTo: route.fullPath, locale: locale.value })
}

async function handleCreateAccount() {
  await authRedirect('https://npmx.social', {
    create: true,
    redirectTo: route.fullPath,
    locale: locale.value,
  })
}

async function handleLogin() {
  if (handleInput.value) {
    // URLS to PDSs are valid for initiating oauth flows
    if (handleInput.value.startsWith('https://') || isAtIdentifierString(handleInput.value)) {
      await authRedirect(handleInput.value, {
        redirectTo: route.fullPath,
        locale: locale.value,
      })
    } else {
      errorMessage.value = $t('auth.modal.default_input_error')
    }
  }
}

watch(handleInput, newHandleInput => {
  errorMessage.value = ''
  if (!newHandleInput) return

  const normalized = newHandleInput.trim().toLowerCase().replace(/@/g, '')

  if (normalized !== newHandleInput) {
    handleInput.value = normalized
  }
})
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
      <ButtonBase class="w-full" @click="logout">
        {{ $t('auth.modal.disconnect') }}
      </ButtonBase>
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
          <InputBase
            id="handle-input"
            v-model="handleInput"
            type="text"
            name="handle"
            :placeholder="$t('auth.modal.handle_placeholder')"
            no-correct
            class="w-full"
            size="medium"
          />
          <p v-if="errorMessage" class="text-red-500 text-xs mt-1" role="alert">
            {{ errorMessage }}
          </p>
        </div>

        <details class="text-sm">
          <summary
            class="text-fg-subtle hover:text-fg-muted transition-colors duration-200 focus-visible:(outline-2 outline-accent/70)"
          >
            {{ $t('auth.modal.what_is_atmosphere') }}
          </summary>
          <div class="mt-3">
            <i18n-t keypath="auth.modal.atmosphere_explanation" tag="p" scope="global">
              <template #npmx>
                <span class="font-bold">npmx.dev</span>
              </template>
              <template #atproto>
                <LinkBase :to="atprotoLink"> AT Protocol </LinkBase>
              </template>
              <template #bluesky>
                <LinkBase to="https://bsky.app"> Bluesky </LinkBase>
              </template>
              <template #tangled>
                <LinkBase to="https://tangled.org"> Tangled </LinkBase>
              </template>
            </i18n-t>
          </div>
        </details>
      </div>

      <ButtonBase type="submit" variant="primary" :disabled="!handleInput.trim()" class="w-full">
        {{ $t('auth.modal.connect') }}
      </ButtonBase>
      <ButtonBase type="button" class="w-full" @click="handleCreateAccount">
        {{ $t('auth.modal.create_account') }}
      </ButtonBase>
      <hr class="color-border" />
      <ButtonBase
        type="button"
        class="w-full"
        @click="handleBlueskySignIn"
        classicon="i-simple-icons:bluesky"
      >
        {{ $t('auth.modal.connect_bluesky') }}
      </ButtonBase>
    </form>
  </Modal>
</template>
