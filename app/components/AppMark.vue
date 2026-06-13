<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 153 153"
    width="153"
    height="153"
    :class="class"
  >
    <title>{{ $t('alt_logo') }}</title>
    <g transform="translate(16.704 9.9827)">
      <path d="m0.93476 97.205h24.081v23.693h-24.081z" fill="currentColor" />
      <path
        d="m103.12-9.2307-3.6211 10.246-46.309 131-3.6211 10.246h15.537l3.6211-10.246 11.717-33.148 38.211-108.1z"
        fill="var(--accent)"
      />
    </g>
  </svg>
</template>
