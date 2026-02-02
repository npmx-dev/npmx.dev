<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    orgName: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)

const hasError = ref(false)

// GitHub provides org avatars at https://github.com/{org}.png
const avatarUrl = computed(() => `https://github.com/${props.orgName}.png?size=128`)

function onError() {
  hasError.value = true
}

// Reset error state when org name changes
watch(
  () => props.orgName,
  () => {
    hasError.value = false
  },
)

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'size-10 text-lg'
    case 'lg':
      return 'size-16 text-2xl'
    default:
      return 'size-14 text-2xl'
  }
})
</script>

<template>
  <div
    class="shrink-0 rounded-lg bg-bg-muted border border-border flex items-center justify-center overflow-hidden"
    :class="sizeClasses"
    role="img"
    :aria-label="`Avatar for @${orgName}`"
  >
    <img
      v-if="!hasError"
      :src="avatarUrl"
      alt=""
      class="w-full h-full object-cover"
      @error="onError"
    />
    <span v-else class="text-fg-subtle font-mono" aria-hidden="true">
      {{ orgName.charAt(0).toUpperCase() }}
    </span>
  </div>
</template>
