<script setup lang="ts">
const showModal = ref(false)
const { user } = useAtproto()
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="relative font-mono text-sm flex items-center justify-center w-fit rounded-md transition-colors duration-200 hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
      @click="showModal = true"
    >
      {{ user?.handle || 'login' }}
    </button>

    <AuthModal v-model:open="showModal" />
  </div>
</template>
