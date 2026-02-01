<script setup lang="ts">
defineProps<{
  /** Number of columns (2-4) */
  columns: number
  /** Column headers (package names or version numbers) */
  headers: string[]
}>()
</script>

<template>
  <div class="overflow-x-auto">
    <div
      class="comparison-grid"
      :class="[columns === 4 ? 'min-w-[800px]' : 'min-w-[600px]', `columns-${columns}`]"
      :style="{ '--columns': columns }"
    >
      <!-- Header row -->
      <div class="comparison-header">
        <div class="comparison-label" />
        <div
          v-for="(header, index) in headers"
          :key="index"
          class="comparison-cell comparison-cell-header"
        >
          <span class="font-mono text-sm font-medium text-fg truncate" :title="header">
            {{ header }}
          </span>
        </div>
      </div>

      <!-- Facet rows -->
      <slot />
    </div>
  </div>
</template>

<style scoped>
.comparison-grid {
  display: grid;
  gap: 0;
}

.comparison-grid.columns-2 {
  grid-template-columns: minmax(120px, 180px) repeat(2, 1fr);
}

.comparison-grid.columns-3 {
  grid-template-columns: minmax(120px, 160px) repeat(3, 1fr);
}

.comparison-grid.columns-4 {
  grid-template-columns: minmax(100px, 140px) repeat(4, 1fr);
}

.comparison-header {
  display: contents;
}

.comparison-header > .comparison-label {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.comparison-header > .comparison-cell-header {
  padding: 0.75rem 1rem;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  text-align: center;
}

/* First header cell rounded top-start */
.comparison-header > .comparison-cell-header:first-of-type {
  border-start-start-radius: 0.5rem;
}

/* Last header cell rounded top-end */
.comparison-header > .comparison-cell-header:last-of-type {
  border-start-end-radius: 0.5rem;
}
</style>
