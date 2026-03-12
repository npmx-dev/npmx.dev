<script setup lang="ts">
const props = defineProps<{
  packageName: string
  version: string
  currentEntrypoint: string
  entrypoints: string[]
}>()

function getEntrypointUrl(entrypoint: string): string {
  return `/package-docs/${props.packageName}/v/${props.version}/${entrypoint}`
}

function onSelect(event: Event) {
  const target = event.target as HTMLSelectElement
  navigateTo(getEntrypointUrl(target.value))
}
</script>

<template>
  <select
    :value="currentEntrypoint"
    aria-label="Select entrypoint"
    class="text-fg-subtle font-mono text-sm bg-transparent border border-border rounded px-2 py-1 hover:text-fg hover:border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
    @change="onSelect"
  >
    <option v-for="ep in entrypoints" :key="ep" :value="ep">./{{ ep }}</option>
  </select>
</template>
