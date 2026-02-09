<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'

export interface ComparisonGridColumn {
  name: string
  version?: string
  /** Module replacement data for this package (if available) */
  replacement?: ModuleReplacement | null
}

const props = defineProps<{
  /** Column definitions for each package being compared */
  columns: ComparisonGridColumn[]
  /** Whether to show the "no dependency" baseline as the last column */
  showNoDependency?: boolean
}>()

/** Total column count including the optional no-dep column */
const totalColumns = computed(() => props.columns.length + (props.showNoDependency ? 1 : 0))

/** Compute plain-text tooltip for a replacement column */
function getReplacementTooltip(col: ComparisonGridColumn): string {
  if (!col.replacement) return ''

  return [$t('package.replacement.title'), $t('package.replacement.learn_more_above')].join(' ')
}
</script>

<template>
  <div class="overflow-x-auto">
    <div
      class="comparison-grid"
      :class="[totalColumns === 4 ? 'min-w-[800px]' : 'min-w-[600px]', `columns-${totalColumns}`]"
      :style="{ '--columns': totalColumns }"
    >
      <!-- Header row -->
      <div class="comparison-header">
        <div class="comparison-label" />

        <!-- Package columns -->
        <div v-for="col in columns" :key="col.name" class="comparison-cell comparison-cell-header">
          <span class="inline-flex items-center gap-1.5 truncate">
            <LinkBase
              :to="packageRoute(col.name, col.version)"
              class="text-sm flex! truncate"
              :title="col.version ? `${col.name}@${col.version}` : col.name"
            >
              {{ col.name }}<template v-if="col.version">@{{ col.version }}</template>
            </LinkBase>
            <TooltipApp v-if="col.replacement" :text="getReplacementTooltip(col)" position="bottom">
              <span
                class="i-carbon:idea w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help"
                role="img"
                :aria-label="$t('package.replacement.title')"
              />
            </TooltipApp>
          </span>
        </div>

        <!-- "No dep" column (always last) -->
        <div
          v-if="showNoDependency"
          class="comparison-cell comparison-cell-header comparison-cell-nodep"
        >
          <span
            class="inline-flex items-center gap-1.5 text-sm font-medium text-accent italic truncate"
          >
            {{ $t('compare.no_dependency.label') }}
            <TooltipApp interactive position="bottom">
              <span
                class="i-carbon:idea w-3.5 h-3.5 text-amber-500 shrink-0 cursor-help"
                role="img"
                :aria-label="$t('compare.no_dependency.tooltip_title')"
              />
              <template #content>
                <p class="text-sm font-medium text-fg mb-1">
                  {{ $t('compare.no_dependency.tooltip_title') }}
                </p>
                <p class="text-xs text-fg-muted">
                  <i18n-t keypath="compare.no_dependency.tooltip_description" tag="span">
                    <template #link>
                      <LinkBase to="https://e18e.dev/docs/replacements/">{{
                        $t('compare.no_dependency.e18e_community')
                      }}</LinkBase>
                    </template>
                  </i18n-t>
                </p>
              </template>
            </TooltipApp>
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

/* "No dep" column styling */
.comparison-header > .comparison-cell-header.comparison-cell-nodep {
  background: linear-gradient(
    135deg,
    var(--color-bg-subtle) 0%,
    color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-subtle)) 100%
  );
  border-bottom-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
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
