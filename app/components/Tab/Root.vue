<script setup lang="ts">
defineOptions({ name: 'TabRoot' })

const props = withDefaults(
  defineProps<{
    idPrefix?: string
  }>(),
  {
    idPrefix: 'tab',
  },
)
const selectedValue = defineModel<string>()

function tabId(value: string): string {
  return `${props.idPrefix}-${value}`
}

function panelId(value: string): string {
  return `${props.idPrefix}-panel-${value}`
}

provide('tabs-selected', selectedValue)
provide('tabs-tab-id', tabId)
provide('tabs-panel-id', panelId)
</script>

<template>
  <div class="tab-root">
    <slot />
  </div>
</template>
