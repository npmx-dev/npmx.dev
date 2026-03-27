<script setup lang="ts">
defineOptions({ name: 'TabPanel' })

const props = defineProps<{
  value: string
  panelId?: string
}>()

const selected = inject<WritableComputedRef<string>>('tabs-selected')
const getTabId = inject<(value: string) => string>('tabs-tab-id')
const getPanelId = inject<(value: string) => string>('tabs-panel-id')

if (!selected || !getTabId || !getPanelId) {
  throw new Error('TabItem must be used inside a TabRoot component')
}

const isSelected = computed(() => selected.value === props.value)
const resolvedPanelId = computed(() => props.panelId ?? getPanelId(props.value))
const resolvedTabId = computed(() => getTabId(props.value))
</script>

<template>
  <div
    v-show="isSelected"
    :id="resolvedPanelId"
    role="tabpanel"
    :aria-labelledby="resolvedTabId"
    :data-selected="isSelected ? '' : undefined"
    :tabindex="0"
  >
    <slot />
  </div>
</template>
