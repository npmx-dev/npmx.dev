<script setup lang="ts">
defineOptions({ name: 'TabRoot' })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    defaultValue?: string
    idPrefix?: string
  }>(),
  {
    idPrefix: 'tab',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const internalValue = shallowRef(props.defaultValue ?? '')

const selectedValue = computed({
  get: () => props.modelValue ?? internalValue.value,
  set: (v: string) => {
    internalValue.value = v
    emit('update:modelValue', v)
  },
})

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
