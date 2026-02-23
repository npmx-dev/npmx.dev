<script setup lang="ts">
const route = useRoute()
const { isConnected, user, login, logout } = useGitHub()

function handleConnect() {
  login(route.fullPath)
}
</script>

<template>
  <Modal :modalTitle="$t('auth.github.title')" class="max-w-lg" id="github-modal">
    <!-- Connected state -->
    <div v-if="isConnected && user" class="space-y-4">
      <div class="flex items-center gap-3 p-4 bg-bg-subtle border border-border rounded-lg">
        <span class="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
        <div>
          <p class="font-mono text-xs text-fg-muted">
            {{ $t('auth.github.connected_as', { username: user.username }) }}
          </p>
        </div>
      </div>
      <ButtonBase class="w-full" @click="logout">
        {{ $t('auth.modal.disconnect') }}
      </ButtonBase>
    </div>

    <!-- Disconnected state -->
    <div v-else class="space-y-4">
      <p class="text-sm text-fg-muted">{{ $t('auth.github.connect_prompt') }}</p>
      <ButtonBase
        variant="primary"
        class="w-full"
        classicon="i-simple-icons:github"
        @click="handleConnect"
      >
        {{ $t('auth.modal.connect') }}
      </ButtonBase>
    </div>
  </Modal>
</template>
