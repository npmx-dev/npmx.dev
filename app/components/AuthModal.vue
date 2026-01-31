<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const handleInput = ref('')

const { user, logout } = useAtproto()

async function handleBlueskySignIn() {
  await navigateTo(
    {
      path: '/api/auth/atproto',
      query: { handle: 'https://bsky.social' },
    },
    { external: true },
  )
}

async function handleCreateAccount() {
  await navigateTo(
    {
      path: '/api/auth/atproto',
      query: { handle: 'https://selfhosted.social', create: 'true' },
    },
    { external: true },
  )
}

async function handleLogin() {
  if (handleInput.value) {
    await navigateTo(
      {
        path: '/api/auth/atproto',
        query: { handle: handleInput.value },
      },
      { external: true },
    )
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          aria-label="Close modal"
          @click="open = false"
        />

        <!-- Modal -->
        <div
          class="relative w-full max-w-lg bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 id="auth-modal-title" class="font-mono text-lg font-medium">Account</h2>
              <button
                type="button"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                aria-label="Close"
                @click="open = false"
              >
                <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div v-if="user?.handle" class="space-y-4">
              <div class="flex items-center gap-3 p-4 bg-bg-subtle border border-border rounded-lg">
                <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
                <div>
                  <p class="font-mono text-xs text-fg-muted">Connected as @{{ user.handle }}</p>
                </div>
              </div>
              <button
                @click="logout"
                class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Logout
              </button>
            </div>

            <!-- Disconnected state -->
            <form v-else class="space-y-4" @submit.prevent="handleLogin">
              <p class="text-sm text-fg-muted">Connect with your Atmosphere account</p>

              <div class="space-y-3">
                <div>
                  <label
                    for="handle-input"
                    class="block text-xs text-fg-subtle uppercase tracking-wider mb-1.5"
                  >
                    Handle
                  </label>
                  <input
                    id="handle-input"
                    v-model="handleInput"
                    type="text"
                    name="handle"
                    placeholder="alice.bsky.social"
                    autocomplete="off"
                    spellcheck="false"
                    class="w-full px-3 py-2 font-mono text-sm bg-bg-subtle border border-border rounded-md text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                  />
                </div>

                <details class="text-sm">
                  <summary
                    class="text-fg-subtle cursor-pointer hover:text-fg-muted transition-colors duration-200"
                  >
                    What is an Atmosphere account?
                  </summary>
                  <div class="mt-3">
                    <p>
                      <span class="font-bold">npmx.dev</span> uses the
                      <a
                        href="https://atproto.com"
                        target="_blank"
                        class="text-blue-400 hover:underline"
                      >
                        AT Protocol
                      </a>
                      to power many of its social features, allowing users to own their data and use
                      one account for all compatible applications. Once you create an account, you
                      can use other apps like
                      <a
                        href="https://bsky.app"
                        target="_blank"
                        class="text-blue-400 hover:underline"
                      >
                        Bluesky
                      </a>
                      and
                      <a
                        href="https://tangled.org"
                        target="_blank"
                        class="text-blue-400 hover:underline"
                      >
                        Tangled
                      </a>
                      with the same account.
                    </p>
                  </div>
                </details>
              </div>

              <button
                type="submit"
                :disabled="!handleInput.trim()"
                class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Connect
              </button>
              <button
                type="button"
                @click="handleCreateAccount"
                class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Create a new account
              </button>
              <hr />
              <button
                type="button"
                @click="handleBlueskySignIn"
                class="w-full px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-all duration-200 hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg flex items-center justify-center gap-2"
              >
                Connect with Bluesky
                <svg fill="none" viewBox="0 0 64 57" width="20" style="width: 20px">
                  <path
                    fill="#0F73FF"
                    d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z"
                  ></path>
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
