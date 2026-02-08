<script setup lang="ts">
import { LinkBase, TagStatic } from '#components'

const props = defineProps<{
  packageName: string
  isBinary?: boolean
  version?: string
}>()

const { data: analysis, status } = usePackageAnalysis(
  () => props.packageName,
  () => props.version,
)

const isLoading = computed(() => status.value !== 'error' && !analysis.value)

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
    return `/package/${analysis.value.types.packageName}`
  }
  return null
})
</script>

<template>
  <ul class="flex items-center gap-1.5 list-none m-0 p-0">
    <!-- TypeScript types badge -->
    <li v-if="!props.isBinary" class="contents">
      <TooltipApp :text="typesTooltip">
        <LinkBase
          v-if="typesHref"
          variant="button-secondary"
          size="small"
          :to="typesHref"
          classicon="i-carbon-checkmark"
        >
          {{ $t('package.metrics.types_label') }}
        </LinkBase>
        <TagStatic
          v-else
          :variant="hasTypes && !isLoading ? 'default' : 'ghost'"
          :tabindex="0"
          :classicon="
            isLoading
              ? 'i-carbon-circle-dash motion-safe:animate-spin'
              : hasTypes
                ? 'i-carbon-checkmark'
                : 'i-carbon-close'
          "
        >
          {{ $t('package.metrics.types_label') }}
        </TagStatic>
      </TooltipApp>
    </li>

    <!-- ESM badge (show with X if missing) -->
    <li class="contents">
      <TooltipApp
        :text="isLoading ? '' : hasEsm ? $t('package.metrics.esm') : $t('package.metrics.no_esm')"
      >
        <TagStatic
          tabindex="0"
          :variant="hasEsm && !isLoading ? 'default' : 'ghost'"
          :classicon="
            isLoading
              ? 'i-carbon-circle-dash motion-safe:animate-spin'
              : hasEsm
                ? 'i-carbon-checkmark'
                : 'i-carbon-close'
          "
        >
          ESM
        </TagStatic>
      </TooltipApp>
    </li>

    <!-- CJS badge -->
    <li v-if="isLoading || hasCjs" class="contents">
      <TooltipApp :text="isLoading ? '' : $t('package.metrics.cjs')">
        <TagStatic
          tabindex="0"
          :variant="isLoading ? 'ghost' : 'default'"
          :classicon="
            isLoading ? 'i-carbon-circle-dash motion-safe:animate-spin' : 'i-carbon-checkmark'
          "
        >
          CJS
        </TagStatic>
      </TooltipApp>
    </li>
  </ul>
</template>
