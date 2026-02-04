<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
}>()

const checked = defineModel<boolean>({
  default: false,
})
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center justify-between gap-4 group"
    role="switch"
    :aria-checked="checked"
    @click="checked = !checked"
  >
    <span v-if="label" class="text-sm text-fg font-medium text-start">
      {{ label }}
    </span>
    <span
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-200 ease-in-out motion-reduce:transition-none cursor-pointer"
      :class="checked ? 'bg-accent border-transparent shadow-sm' : 'bg-bg border border-border/50'"
      aria-hidden="true"
    >
      <span
        class="pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
        :class="checked ? 'bg-bg' : 'bg-fg-muted'"
      />
    </span>
  </button>
  <p v-if="description" class="text-sm text-fg-muted">
    {{ description }}
  </p>
</template>

<style scoped>
button[aria-checked='false'] > span:last-of-type > span {
  translate: 0;
}
button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(100%);
}
html[dir='rtl'] button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(-100%);
}
</style>
