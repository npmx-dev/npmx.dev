<script setup lang="ts">
import { parseLicenseExpression } from '#shared/utils/spdx'

const props = defineProps<{
  license: string
}>()

const tokens = computed(() => parseLicenseExpression(props.license))

const hasAnyValidLicense = computed(() => tokens.value.some(t => t.type === 'license' && t.url))
</script>

<template>
  <span class="inline-flex items-baseline gap-x-1.5 flex-wrap gap-y-0.5">
    <template v-for="(token, i) in tokens" :key="i">
      <a
        v-if="token.type === 'license' && token.url"
        :href="token.url"
        target="_blank"
        rel="noopener noreferrer"
        class="link-subtle"
        title="View license text on SPDX"
      >
        {{ token.value }}
      </a>
      <span v-else-if="token.type === 'license'">{{ token.value }}</span>
      <span v-else-if="token.type === 'operator'" class="text-[0.65em]">{{ token.value }}</span>
    </template>
    <span
      v-if="hasAnyValidLicense"
      class="i-carbon-scales w-3.5 h-3.5 text-fg-subtle flex-shrink-0 inline-block self-center"
      aria-hidden="true"
    />
  </span>
</template>
