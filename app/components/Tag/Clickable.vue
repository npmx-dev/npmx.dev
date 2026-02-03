<script setup lang="ts">
const props = withDefaults(
  defineProps<{ as?: string | Component; status?: 'default' | 'active'; disabled?: boolean }>(),
  {
    status: 'default',
    as: 'button',
  },
)
</script>

<template>
  <component
    :is="props.as"
    class="inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
    :class="{
      'bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover)':
        status === 'default',
      'bg-fg text-bg border-fg hover:(text-text-bg/50)': status === 'active',
      'opacity-50 cursor-not-allowed': disabled,
    }"
    :disabled="disabled"
  >
    <slot />
  </component>
</template>
