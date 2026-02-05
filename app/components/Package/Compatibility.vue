<script setup lang="ts">
const props = defineProps<{
  engines?: Record<string, string>
}>()

const engineNames: Record<string, string> = {
  bun: 'Bun',
  node: 'Node.js',
  npm: 'npm',
}

// Map engine name to icon class
const engineIcons: Record<string, string> = {
  bun: 'i-simple-icons:bun',
  node: 'i-simple-icons:nodedotjs',
  npm: 'i-simple-icons:npm',
}

function getName(engine: string): string {
  return engineNames[engine] || engine
}

function getIcon(engine: string): string {
  return engineIcons[engine] || 'i-carbon:code'
}

const sortedEngines = computed(() => {
  const entries = Object.entries(props.engines ?? {})
  return entries.sort(([a], [b]) => a.localeCompare(b))
})
</script>
<template>
  <CollapsibleSection
    v-if="sortedEngines.length"
    :title="$t('package.compatibility')"
    id="compatibility"
  >
    <dl class="space-y-2">
      <div
        v-for="[engine, version] in sortedEngines"
        :key="engine"
        class="flex justify-between gap-4 py-1"
      >
        <dt class="flex items-center gap-2 text-fg-muted text-sm shrink-0">
          <span
            :class="[getIcon(engine), 'inline-block w-4 h-4 shrink-0 text-fg-muted']"
            aria-hidden="true"
          />
          {{ getName(engine) }}
        </dt>
        <dd class="font-mono text-sm text-fg text-end" :title="version">
          {{ version }}
        </dd>
      </div>
    </dl>
  </CollapsibleSection>
</template>
