<script setup lang="ts">
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'
import type { VulnerabilityTreeResult } from '#shared/types/dependency-analysis'
import { getVulnerableDepInfo, getDeprecatedDepInfo } from '~/utils/npm/problematic-dependencies'

const props = defineProps<{
  name: string
  packageName?: string
  flags?: string[]
  insights?: PackageDependencyInsights
  deprecated?: boolean | string
  hasReplacement?: boolean
  vulnTree?: VulnerabilityTreeResult
  isLoading?: boolean
}>()

const structuralMeta = computed<Record<string, { icon: string; text: string }>>(() => ({
  optional: { icon: 'i-lucide:circle-dashed', text: $t('package.dependencies.optional') },
  bundled: { icon: 'i-lucide:package', text: $t('package.dependencies.bundled') },
}))

const realPackageName = computed(() => props.packageName || props.name)

const isAliased = computed(() => !!props.packageName && props.packageName !== props.name)

const isDataLoading = computed(() => {
  if (props.isLoading !== undefined) return props.isLoading
  if (props.insights) {
    return (
      unref(props.insights.vulnStatus) === 'pending' ||
      unref(props.insights.replacementStatus) === 'pending'
    )
  }
  return false
})

const healthStatusAlerts = computed(() => {
  if (!props.name) return []

  const alerts: Array<{
    key: string
    icon: string
    cssClass: string
    tooltipText: string
  }> = []

  const effectiveVulnTree = props.insights ? unref(props.insights.vulnTree) : props.vulnTree

  if (getVulnerableDepInfo(realPackageName.value, effectiveVulnTree)) {
    alerts.push({
      key: 'vulnerable',
      icon: 'i-lucide:shield-alert',
      cssClass: 'text-red-600',
      tooltipText: $t('package.dependencies.vulnerable'),
    })
  }

  if (getDeprecatedDepInfo(realPackageName.value, effectiveVulnTree, props.deprecated)) {
    alerts.push({
      key: 'deprecated',
      icon: 'i-lucide:octagon-alert',
      cssClass: 'text-purple-700 dark:text-purple-500',
      tooltipText: $t('package.deprecated.label'),
    })
  }

  const replacementAvailable = props.insights
    ? !!unref(props.insights.replacementDeps)?.[props.name]
    : !!props.hasReplacement

  if (replacementAvailable) {
    alerts.push({
      key: 'replacement',
      icon: 'i-lucide:lightbulb',
      cssClass: 'text-amber-700 dark:text-amber-500',
      tooltipText: $t('package.dependencies.has_replacement'),
    })
  }

  return alerts
})
</script>

<template>
  <span class="inline-flex shrink-0 z-20">
    <TooltipApp
      v-if="isAliased"
      :text="$t('package.dependencies.aliased_to', { name: realPackageName })"
      class="items-center shrink-0"
    >
      <span class="inline-flex items-center justify-center p-3 -my-3 cursor-help">
        <span class="i-lucide:arrow-right-left w-3.5 h-3.5 text-fg-subtle" aria-hidden="true" />
      </span>
    </TooltipApp>

    <template v-for="attribute in flags" :key="attribute">
      <TooltipApp
        v-if="structuralMeta[attribute]"
        :text="structuralMeta[attribute].text"
        class="items-center shrink-0"
      >
        <span class="inline-flex items-center justify-center p-3 -my-3 cursor-help">
          <span
            :class="structuralMeta[attribute].icon"
            class="w-3.5 h-3.5 text-fg-subtle"
            aria-hidden="true"
          />
        </span>
      </TooltipApp>
    </template>

    <TooltipApp v-if="isDataLoading" :text="$t('common.loading')" class="items-center shrink-0">
      <span class="inline-flex items-center justify-center p-3 -my-3 cursor-help">
        <span class="i-svg-spinners:ring-resize w-3.5 h-3.5 text-fg-subtle" aria-hidden="true" />
      </span>
    </TooltipApp>

    <TooltipApp
      v-for="alert in healthStatusAlerts"
      :key="alert.key"
      :text="alert.tooltipText"
      class="items-center shrink-0"
    >
      <span class="inline-flex items-center justify-center p-3 -my-3 cursor-help">
        <span :class="[alert.icon, alert.cssClass]" class="w-3.5 h-3.5" aria-hidden="true" />
      </span>
    </TooltipApp>
  </span>
</template>
