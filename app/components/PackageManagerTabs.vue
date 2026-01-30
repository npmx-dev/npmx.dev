<script setup lang="ts">
const selectedPM = useSelectedPackageManager()
</script>

<template>
  <div
    class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md overflow-x-auto"
    role="tablist"
    :aria-label="$t('package.get_started.pm_label')"
  >
    <button
      v-for="pm in packageManagers"
      :key="pm.id"
      role="tab"
      :data-pm-tab="pm.id"
      :aria-selected="selectedPM === pm.id"
      class="pm-tab px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 inline-flex items-center gap-1.5 hover:text-fg"
      @click="selectedPM = pm.id"
    >
      <span class="inline-block h-3 w-3" :class="pm.icon" aria-hidden="true" />
      {{ pm.label }}
    </button>
  </div>
</template>

<style>
/*
 * Package manager tab styling based on data-pm attribute on <html>.
 * Selected tab gets highlighted background and border.
 */

[data-pm-tab] {
  --pm-tab-bg: transparent;
  --pm-tab-border: transparent;
  --pm-tab-shadow: none;
  background: var(--pm-tab-bg);
  border-color: var(--pm-tab-border);
  box-shadow: var(--pm-tab-shadow);
  color: var(--fg-subtle);
}

:root[data-pm='npm'] [data-pm-tab='npm'],
:root[data-pm='pnpm'] [data-pm-tab='pnpm'],
:root[data-pm='yarn'] [data-pm-tab='yarn'],
:root[data-pm='bun'] [data-pm-tab='bun'],
:root[data-pm='deno'] [data-pm-tab='deno'],
:root[data-pm='vlt'] [data-pm-tab='vlt'] {
  --pm-tab-bg: var(--bg);
  --pm-tab-border: var(--border);
  --pm-tab-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: var(--fg);
}

/* Fallback: when no data-pm is set, npm is selected by default */
:root:not([data-pm]) [data-pm-tab='npm'] {
  --pm-tab-bg: var(--bg);
  --pm-tab-border: var(--border);
  --pm-tab-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  color: var(--fg);
}
</style>
