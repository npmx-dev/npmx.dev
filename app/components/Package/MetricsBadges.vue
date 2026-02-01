<script setup lang="ts">
import { NuxtLink } from '#components'

const props = defineProps<{
  packageName: string
  isBinary?: boolean
  version?: string
}>()

const { data: analysis } = usePackageAnalysis(
  () => props.packageName,
  () => props.version,
)

// ESM support
const hasEsm = computed(() => {
  if (!analysis.value) return false
  return analysis.value.moduleFormat === 'esm' || analysis.value.moduleFormat === 'dual'
})

// CJS support (only show badge if present, omit if missing)
const hasCjs = computed(() => {
  if (!analysis.value) return false
  return analysis.value.moduleFormat === 'cjs' || analysis.value.moduleFormat === 'dual'
})

// Types support
const hasTypes = computed(() => {
  if (!analysis.value) return false
  return analysis.value.types?.kind === 'included' || analysis.value.types?.kind === '@types'
})

const typesTooltip = computed(() => {
  if (!analysis.value) return ''
  switch (analysis.value.types?.kind) {
    case 'included':
      return $t('package.metrics.types_included')
    case '@types':
      return $t('package.metrics.types_available', { package: analysis.value.types.packageName })
    default:
      return $t('package.metrics.no_types')
  }
})

const typesHref = computed(() => {
  if (!analysis.value) return null
  if (analysis.value.types?.kind === '@types') {
    return `/${analysis.value.types.packageName}`
  }
  return null
})
</script>

<template>
  <ul v-if="analysis" class="flex items-center gap-1.5 list-none m-0 p-0">
    <!-- TypeScript types badge -->
    <li v-if="!props.isBinary">
      <TooltipApp :text="typesTooltip">
        <component
          :is="typesHref ? NuxtLink : 'span'"
          :to="typesHref"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs rounded transition-colors duration-200"
          :class="[
            hasTypes
              ? 'text-fg-muted bg-bg-muted border border-border'
              : 'text-fg-subtle bg-bg-subtle border border-border-subtle',
            typesHref
              ? 'hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50'
              : '',
          ]"
        >
          <span
            class="w-3 h-3"
            :class="hasTypes ? 'i-carbon-checkmark' : 'i-carbon-close'"
            aria-hidden="true"
          />
          {{ $t('package.metrics.types_label') }}
        </component>
      </TooltipApp>
    </li>

    <!-- ESM badge (show with X if missing) -->
    <li>
      <TooltipApp :text="hasEsm ? $t('package.metrics.esm') : $t('package.metrics.no_esm')">
        <span
          class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs rounded transition-colors duration-200"
          :class="
            hasEsm
              ? 'text-fg-muted bg-bg-muted border border-border'
              : 'text-fg-subtle bg-bg-subtle border border-border-subtle'
          "
        >
          <span
            class="w-3 h-3"
            :class="hasEsm ? 'i-carbon-checkmark' : 'i-carbon-close'"
            aria-hidden="true"
          />
          ESM
        </span>
      </TooltipApp>
    </li>

    <!-- CJS badge (only show if present) -->
    <li v-if="hasCjs">
      <TooltipApp :text="$t('package.metrics.cjs')">
        <span
          class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs text-fg-muted bg-bg-muted border border-border rounded transition-colors duration-200"
        >
          <span class="i-carbon-checkmark w-3 h-3" aria-hidden="true" />
          CJS
        </span>
      </TooltipApp>
    </li>
  </ul>
</template>
