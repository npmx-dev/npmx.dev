<script setup lang="ts">
const props = defineProps<{
  engines?: {
    node?: string
    npm?: string
  }
}>()
</script>
<template>
  <CollapsibleSection
    v-if="engines && (engines.node || engines.npm)"
    :title="$t('package.compatibility')"
    id="compatibility"
  >
    <dl class="space-y-2">
      <div v-if="engines.node" class="flex justify-between gap-4 py-1">
        <dt class="text-fg-muted text-sm shrink-0">node</dt>
        <dd class="font-mono text-sm text-fg text-end" :title="engines.node">
          {{ engines.node }}
        </dd>
      </div>
      <div v-if="engines.npm" class="flex justify-between gap-4 py-1">
        <dt class="text-fg-muted text-sm shrink-0">npm</dt>
        <dd class="font-mono text-sm text-fg text-end" :title="engines.npm">
          {{ engines.npm }}
        </dd>
      </div>
    </dl>
  </CollapsibleSection>
</template>
