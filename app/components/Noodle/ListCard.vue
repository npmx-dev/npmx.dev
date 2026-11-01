<script setup lang="ts">
import type { Noodle } from '#shared/schemas/noodle'
import { resolveNoodleLogo } from '../Noodle'

const props = defineProps<{
  noodle: Noodle
}>()

const logo = computed(() => resolveNoodleLogo(props.noodle.key))
</script>

<template>
  <NuxtLink
    :to="`/noodles/${noodle.slug}`"
    class="group relative block rounded-xl border border-border bg-bg-elevated overflow-hidden transition-colors hover:border-border-hover decoration-none"
  >
    <span class="sr-only">{{ noodle.title }}</span>
    <div class="aspect-[4/3] flex items-center justify-center bg-bg p-8 overflow-hidden">
      <component :is="logo" v-if="logo" no-tooltip class="max-w-full! max-h-full!" />
      <span v-else class="i-lucide:sparkles w-12 h-12 text-fg-subtle" aria-hidden="true" />
    </div>
    <div class="absolute top-3 inset-ie-3 text-fg-subtle group-hover:text-fg transition-colors">
      <span class="i-lucide:arrow-up-right rtl-flip w-4 h-4" aria-hidden="true" />
    </div>
    <div
      class="border-t border-border px-4 py-3 flex items-center gap-2 text-xs text-fg-muted font-mono"
    >
      <span class="text-fg-subtle">//</span>
      <DateTime :datetime="noodle.date" year="numeric" month="2-digit" day="2-digit" />
      <template v-if="noodle.dateTo">
        <span class="text-fg-subtle">—</span>
        <DateTime :datetime="noodle.dateTo" year="numeric" month="2-digit" day="2-digit" />
      </template>
    </div>
  </NuxtLink>
</template>
