<script setup lang="ts">
const props = defineProps<{
  packages: string[]
}>()

const { open } = useAddToCollection()
</script>

<template>
  <ButtonBase classicon="i-lucide:bookmark-plus" @click="open(props.packages)">
    <slot>{{ $t('collections.picker.title') }}</slot>
  </ButtonBase>
</template>
