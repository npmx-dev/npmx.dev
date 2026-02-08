<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const status = computed(() => props.error.statusCode || 500)
const statusText = computed(() => {
  if (props.error.statusMessage) return props.error.statusMessage
  switch (status.value) {
    case 401:
      return 'Unauthorized'
    case 404:
      return 'Page not found'
    case 500:
      return 'Internal server error'
    case 503:
      return 'Service unavailable'
    default:
      return 'Something went wrong'
  }
})

function handleError() {
  clearError({ redirect: '/' })
}

useHead({
  title: `${status.value} - ${statusText.value}`,
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg text-fg">
    <AppHeader />

    <main class="flex-1 container flex flex-col items-center justify-center py-20 text-center">
      <p class="font-mono text-8xl sm:text-9xl font-medium text-fg-subtle mb-4">
        {{ status }}
      </p>

      <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-4">
        {{ statusText }}
      </h1>

      <p
        v-if="error.message && error.message !== statusText"
        class="text-fg-muted text-base max-w-md mb-8"
      >
        {{ error.message }}
      </p>

      <button
        type="button"
        class="font-mono text-sm px-6 py-3 bg-fg text-bg rounded-lg transition-all duration-200 hover:bg-fg/90 active:scale-95"
        @click="handleError"
      >
        go home
      </button>
    </main>

    <AppFooter />
  </div>
</template>
