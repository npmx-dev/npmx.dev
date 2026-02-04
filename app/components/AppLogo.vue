<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width="96"
    height="96"
    :class="class"
  >
    <title>{{ $t('alt_logo') }}</title>
    <rect fill="var(--bg)" width="512" height="512" rx="64" />
    <rect fill="var(--fg)" x="110" y="310" width="60" height="60" />
    <text
      fill="var(--accent)"
      x="320"
      y="370"
      font-family="'Geist Mono',ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
      font-size="420"
      font-weight="500"
      text-anchor="middle"
    >
      <tspan>/</tspan>
    </text>
  </svg>
</template>
