<script setup lang="ts">
interface Props {
  variant: 'warning' | 'error'
  title?: string
}

defineProps<Props>()

const WRAPPER_CLASSES: Record<Props['variant'], string> = {
  warning: 'border-amber-400/20 bg-amber-500/8',
  error: 'border-red-400/20 bg-red-500/8',
}

const TITLE_CLASSES: Record<Props['variant'], string> = {
  warning: 'text-amber-800 dark:text-amber-300',
  error: 'text-red-800 dark:text-red-300',
}

const BODY_CLASSES: Record<Props['variant'], string> = {
  warning: 'text-amber-700 dark:text-amber-400',
  error: 'text-red-700 dark:text-red-400',
}

const ROLES: Record<Props['variant'], 'status' | 'alert'> = {
  warning: 'status',
  error: 'alert',
}
</script>

<template>
  <div
    :role="ROLES[variant]"
    class="border rounded-md px-3 py-2.5"
    :class="WRAPPER_CLASSES[variant]"
  >
    <p v-if="title" class="font-semibold mb-1" :class="TITLE_CLASSES[variant]">{{ title }}</p>
    <div class="text-xs" :class="BODY_CLASSES[variant]">
      <slot />
    </div>
  </div>
</template>
