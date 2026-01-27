<script setup lang="ts">
import { NuxtLink } from '#components'

const props = defineProps<{
  packageName: string
  version?: string
}>()

const { data: analysis } = usePackageAnalysis(
  () => props.packageName,
  () => props.version,
)

const moduleFormatLabel = computed(() => {
  if (!analysis.value) return null
  switch (analysis.value.moduleFormat) {
    case 'esm':
      return 'ESM'
    case 'cjs':
      return 'CJS'
    case 'dual':
      return 'CJS/ESM'
    default:
      return null
  }
})

const moduleFormatTooltip = computed(() => {
  if (!analysis.value) return ''
  switch (analysis.value.moduleFormat) {
    case 'esm':
      return $t('package.metrics.esm')
    case 'cjs':
      return $t('package.metrics.cjs')
    case 'dual':
      return $t('package.metrics.dual')
    default:
      return $t('package.metrics.unknown_format')
  }
})

const hasTypes = computed(() => {
  if (!analysis.value) return false
  return analysis.value.types?.kind === 'included' || analysis.value.types?.kind === '@types'
})

const typesTooltip = computed(() => {
  if (!analysis.value) return ''
  switch (analysis.value.types?.kind) {
    case 'included':
      return $t('package.metrics.ts_included')
    case '@types':
      return $t('package.metrics.types_from', { package: analysis.value.types.packageName })
    default:
      return ''
  }
})

const typesHref = computed(() => {
  if (!analysis.value) return null
  if (analysis.value.types.kind === '@types') {
    return `/${analysis.value.types.packageName}`
  }
  return null
})
</script>

<template>
  <ul v-if="analysis" class="flex items-center gap-1.5 list-none m-0 p-0">
    <!-- TypeScript types -->
    <li v-if="hasTypes">
      <component
        :is="typesHref ? NuxtLink : 'span'"
        :to="typesHref"
        class="inline-flex items-center px-1.5 py-0.5 font-mono text-xs text-fg-muted bg-bg-muted border border-border rounded transition-colors duration-200"
        :class="
          typesHref
            ? 'hover:text-fg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50'
            : ''
        "
        :title="typesTooltip"
      >
        TS
      </component>
    </li>

    <!-- Module format -->
    <li v-if="moduleFormatLabel">
      <span
        class="inline-flex items-center px-1.5 py-0.5 font-mono text-xs text-fg-muted bg-bg-muted border border-border rounded transition-colors duration-200"
        :title="moduleFormatTooltip"
      >
        {{ moduleFormatLabel }}
      </span>
    </li>
  </ul>
</template>
