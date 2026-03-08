<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    justify?: 'between' | 'start'
    tooltip?: string
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
    tooltipTo?: string
    tooltipOffset?: number
    reverseOrder?: boolean
  }>(),
  {
    justify: 'between',
    reverseOrder: false,
  },
)
</script>

<template>
  <div
    class="grid items-center gap-1.5 py-1 -my-1 grid-cols-[auto_1fr_auto]"
    :class="[justify === 'start' ? 'justify-start' : '']"
    :style="
      props.reverseOrder
        ? 'grid-template-areas: \'toggle . label-text\''
        : 'grid-template-areas: \'label-text . toggle\''
    "
  >
    <template v-if="props.reverseOrder">
      <SkeletonBlock class="h-6 w-11 shrink-0 rounded-full" style="grid-area: toggle" />
      <span
        v-if="label"
        class="text-sm text-fg font-medium text-start"
        style="grid-area: label-text"
      >
        {{ label }}
      </span>
    </template>
    <template v-else>
      <span
        v-if="label"
        class="text-sm text-fg font-medium text-start"
        style="grid-area: label-text"
      >
        {{ label }}
      </span>
      <SkeletonBlock
        class="h-6 w-11 shrink-0 rounded-full"
        style="grid-area: toggle; justify-self: end"
      />
    </template>
  </div>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>
