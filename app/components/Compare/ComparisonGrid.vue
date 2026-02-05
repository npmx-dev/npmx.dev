<script setup lang="ts">
import type { ModuleReplacement } from 'module-replacements'

const props = defineProps<{
  /** Number of columns (2-4) */
  columns: number
  /** Column headers (package names or version numbers) */
  headers: string[]
  /** Which columns are the "no dependency" column */
  specialColumns?: boolean[]
  /** Replacement data for each column (if available) */
  replacements?: (ModuleReplacement | null)[]
}>()

// Tooltip state
const activeTooltip = shallowRef<{
  type: 'nodep' | 'replacement'
  index: number
} | null>(null)

// Computed message for active replacement tooltip
const activeReplacementMessage = computed<
  [string, { replacement?: string; nodeVersion?: string }] | null
>(() => {
  if (activeTooltip.value?.type !== 'replacement') return null
  const replacement = props.replacements?.[activeTooltip.value.index]
  if (!replacement) return null

  switch (replacement.type) {
    case 'native':
      return [
        'package.replacement.native',
        {
          replacement: replacement.replacement,
          nodeVersion: replacement.nodeVersion,
        },
      ]
    case 'simple':
      return [
        'package.replacement.simple',
        {
          replacement: replacement.replacement,
        },
      ]
    case 'documented':
      return ['package.replacement.documented', {}]
    default:
      return null
  }
})
const tooltipTrigger = shallowRef<HTMLElement | null>(null)
const tooltipPosition = shallowRef({ top: 0, left: 0 })
const hideTimeout = shallowRef<ReturnType<typeof setTimeout> | null>(null)

function updateTooltipPosition() {
  if (!tooltipTrigger.value) return
  const rect = tooltipTrigger.value.getBoundingClientRect()
  tooltipPosition.value = {
    top: rect.bottom + 8,
    left: rect.left + rect.width / 2,
  }
}

function cancelHide() {
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
}

function showNoDep(event: MouseEvent | FocusEvent) {
  cancelHide()
  tooltipTrigger.value = event.currentTarget as HTMLElement
  updateTooltipPosition()
  activeTooltip.value = { type: 'nodep', index: -1 }
}

function showReplacement(event: MouseEvent | FocusEvent, index: number) {
  cancelHide()
  tooltipTrigger.value = event.currentTarget as HTMLElement
  updateTooltipPosition()
  activeTooltip.value = { type: 'replacement', index }
}

function hideTooltip() {
  hideTimeout.value = setTimeout(() => {
    activeTooltip.value = null
  }, 150)
}

function onTooltipEnter() {
  cancelHide()
}

function onTooltipLeave() {
  activeTooltip.value = null
}
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
          :class="{ 'comparison-cell-special': specialColumns?.[index] }"
        >
          <!-- "No dep" header with tooltip (James easter egg) -->
          <button
            v-if="specialColumns?.[index]"
            type="button"
            class="inline-flex items-center gap-1.5 cursor-help bg-transparent border-0 p-0"
            :aria-label="$t('compare.no_dependency.label')"
            @mouseenter="showNoDep"
            @mouseleave="hideTooltip"
            @focus="showNoDep"
            @blur="hideTooltip"
          >
            <span class="text-sm font-medium text-accent italic truncate">
              {{ header }}
            </span>
            <span class="i-carbon:help w-3 h-3 text-accent/60" aria-hidden="true" />
          </button>

          <!-- Package header with replacement info -->
          <button
            v-else-if="replacements?.[index]"
            type="button"
            class="inline-flex items-center gap-1.5 cursor-help bg-transparent border-0 p-0"
            :aria-label="$t('package.replacement.title')"
            @mouseenter="showReplacement($event, index)"
            @mouseleave="hideTooltip"
            @focus="showReplacement($event, index)"
            @blur="hideTooltip"
          >
            <span class="font-mono text-sm font-medium text-fg truncate" :title="header">
              {{ header }}
            </span>
            <span class="i-carbon:idea w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          </button>

          <!-- Regular package header (no replacement) -->
          <NuxtLink
            v-else
            :to="`/package/${header}`"
            class="link-subtle font-mono text-sm font-medium text-fg truncate"
            :title="header"
          >
            {{ header }}
          </NuxtLink>
        </div>
      </div>

      <!-- Facet rows -->
      <slot />
    </div>

    <!-- Tooltips (teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100"
        leave-to-class="opacity-0"
      >
        <!-- "No dep" tooltip -->
        <div
          v-if="activeTooltip?.type === 'nodep'"
          role="tooltip"
          class="fixed z-[100] w-72 p-3 bg-bg-elevated border border-border rounded-lg shadow-lg text-start -translate-x-1/2"
          :style="{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }"
          @mouseenter="onTooltipEnter"
          @mouseleave="onTooltipLeave"
        >
          <div class="flex gap-3">
            <img
              src="/43081j.png"
              alt="James Garbutt"
              class="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
            <div class="min-w-0">
              <p class="text-xs text-accent italic mb-0.5">
                {{ $t('compare.no_dependency.james_says') }}
              </p>
              <p class="text-sm font-medium text-fg mb-1">
                {{ $t('package.replacement.title') }}
              </p>
              <p class="text-xs text-fg-muted">
                <i18n-t keypath="compare.no_dependency.tooltip_description" tag="span">
                  <template #link>
                    <a
                      href="https://e18e.dev/docs/replacements/"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-accent hover:underline"
                      >{{ $t('compare.no_dependency.e18e_community') }}</a
                    >
                  </template>
                </i18n-t>
              </p>
            </div>
          </div>
          <!-- Tooltip arrow -->
          <div
            class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-bg-elevated border-t border-l border-border rotate-45"
          />
        </div>

        <!-- Replacement tooltip -->
        <div
          v-else-if="activeReplacementMessage"
          role="tooltip"
          class="fixed z-[100] w-80 p-3 bg-bg-elevated border border-amber-600/30 rounded-lg shadow-lg text-start -translate-x-1/2"
          :style="{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }"
          @mouseenter="onTooltipEnter"
          @mouseleave="onTooltipLeave"
        >
          <div class="flex items-start gap-2">
            <span
              class="i-carbon:idea w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <p class="text-sm font-medium text-fg mb-1">
                {{ $t('package.replacement.title') }}
              </p>
              <p class="text-xs text-fg-muted">
                <i18n-t :keypath="activeReplacementMessage[0]" tag="span">
                  <template #replacement>
                    {{ activeReplacementMessage[1].replacement ?? '' }}
                  </template>
                  <template #nodeVersion>
                    {{ activeReplacementMessage[1].nodeVersion ?? '' }}
                  </template>
                  <template #community>
                    {{ $t('package.replacement.community') }}
                  </template>
                </i18n-t>
              </p>
            </div>
          </div>
          <!-- Tooltip arrow -->
          <div
            class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-bg-elevated border-t border-l border-amber-600/30 rotate-45"
          />
        </div>
      </Transition>
    </Teleport>
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
.comparison-header > .comparison-cell-header.comparison-cell-special {
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
