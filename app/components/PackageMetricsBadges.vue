<script setup lang="ts">
import type { ModuleFormat, TypesStatus } from '#shared/utils/package-analysis'

const props = defineProps<{
  packageName: string
  version?: string
}>()

interface PackageAnalysisResponse {
  package: string
  version: string
  moduleFormat: ModuleFormat
  types: TypesStatus
  engines?: {
    node?: string
    npm?: string
  }
}

const { data: analysis, status } = useLazyFetch<PackageAnalysisResponse>(
  () => {
    const base = `/api/registry/analysis/${props.packageName}`
    return props.version ? `${base}/v/${props.version}` : base
  },
  {
    server: false, // Client-side only to avoid blocking initial render
  },
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
      return 'ES Modules only'
    case 'cjs':
      return 'CommonJS only'
    case 'dual':
      return 'Supports both CommonJS and ES Modules'
    default:
      return 'Unknown module format'
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
      return 'TypeScript types included'
    case '@types':
      return `Types from ${analysis.value.types.packageName}`
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
        :is="typesHref ? 'NuxtLink' : 'span'"
        :to="typesHref"
        class="inline-flex items-center px-1.5 py-0.5 font-mono text-xs text-fg-muted bg-bg-muted border border-border rounded transition-colors duration-200"
        :class="typesHref ? 'hover:text-fg hover:border-border-hover' : ''"
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
