<script setup lang="ts">
import type { PackageDependencySection } from '#shared/types/package-dependencies'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'
import { getVulnerableDepInfo, getDeprecatedDepInfo } from '~/utils/npm/problematic-dependencies'

const selectedInsights = defineModel<string[]>('selectedInsights', { default: () => [] })

function toggleInsight(id: string) {
  if (selectedInsights.value.includes(id)) {
    selectedInsights.value = selectedInsights.value.filter(i => i !== id)
  } else {
    selectedInsights.value = [...selectedInsights.value, id]
  }
}

const props = withDefaults(
  defineProps<{
    insights?: PackageDependencyInsights
    sections: PackageDependencySection[]
    activeSections?: string[]
    showSkeleton: boolean
    packageName?: string
    interactive?: boolean
  }>(),
  {
    interactive: true,
  },
)

const stats = computed(() => {
  const urgent = { major: 0, minor: 0, patch: 0, vulnerable: 0, deprecated: 0, replacement: 0 }
  const nonUrgent = { major: 0, minor: 0, patch: 0, vulnerable: 0, deprecated: 0, replacement: 0 }
  const active = { major: 0, minor: 0, patch: 0, vulnerable: 0, deprecated: 0, replacement: 0 }

  if (!props.insights) return { urgent, nonUrgent, active }

  for (const section of props.sections) {
    const isUrgent = ['dependencies', 'bundledDependencies'].includes(section.id)
    const isActive = !props.activeSections || props.activeSections.includes(section.id)
    const target = isUrgent ? urgent : nonUrgent

    for (const item of section.items) {
      const outdated = props.insights.outdatedDeps.value?.[item.name]
      if (outdated) {
        if (outdated.majorsBehind > 0) {
          target.major++
          if (isActive) active.major++
        } else if (outdated.minorsBehind > 0) {
          target.minor++
          if (isActive) active.minor++
        } else if (outdated.resolved !== outdated.latest) {
          target.patch++
          if (isActive) active.patch++
        }
      }

      if (props.insights.replacementDeps.value?.[item.name]) {
        target.replacement++
        if (isActive) active.replacement++
      }
      const realName = item.packageName || item.name
      if (getVulnerableDepInfo(realName, props.insights.vulnTree.value)) {
        target.vulnerable++
        if (isActive) active.vulnerable++
      }
      if (getDeprecatedDepInfo(realName, props.insights.vulnTree.value)) {
        target.deprecated++
        if (isActive) active.deprecated++
      }
    }
  }

  return { urgent, nonUrgent, active }
})

const vulnLoading = computed(
  () =>
    !props.insights ||
    props.insights.vulnStatus?.value === 'idle' ||
    props.insights.vulnStatus?.value === 'pending',
)
const outdatedLoading = computed(
  () =>
    !props.insights ||
    props.insights.outdatedStatus?.value === 'idle' ||
    props.insights.outdatedStatus?.value === 'pending',
)
const replacementLoading = computed(
  () =>
    !props.insights ||
    props.insights.replacementStatus?.value === 'idle' ||
    props.insights.replacementStatus?.value === 'pending',
)

interface InsightMetric {
  id: string
  label: string
  icon: string
  iconColor: string
  loading: boolean
  urgentCount: number
  nonUrgentCount: number
  totalCount: number
  activeCount: number
}

const metrics = computed<InsightMetric[]>(() => [
  {
    id: 'major',
    label: $t('package.dependencies.insights.major_behind'),
    icon: 'i-lucide:arrow-up',
    iconColor: 'text-red-700 dark:text-red-500',
    loading: outdatedLoading.value,
    urgentCount: stats.value.urgent.major,
    nonUrgentCount: stats.value.nonUrgent.major,
    totalCount: stats.value.urgent.major + stats.value.nonUrgent.major,
    activeCount: stats.value.active.major,
  },
  {
    id: 'minor',
    label: $t('package.dependencies.insights.minor_behind'),
    icon: 'i-lucide:arrow-up',
    iconColor: 'text-orange-700 dark:text-orange-500',
    loading: outdatedLoading.value,
    urgentCount: stats.value.urgent.minor,
    nonUrgentCount: stats.value.nonUrgent.minor,
    totalCount: stats.value.urgent.minor + stats.value.nonUrgent.minor,
    activeCount: stats.value.active.minor,
  },
  {
    id: 'patch',
    label: $t('package.dependencies.insights.patch_behind'),
    icon: 'i-lucide:arrow-up',
    iconColor: 'text-yellow-700 dark:text-yellow-500',
    loading: outdatedLoading.value,
    urgentCount: stats.value.urgent.patch,
    nonUrgentCount: stats.value.nonUrgent.patch,
    totalCount: stats.value.urgent.patch + stats.value.nonUrgent.patch,
    activeCount: stats.value.active.patch,
  },
  {
    id: 'vulnerable',
    label: $t('package.dependencies.insights.vulnerable'),
    icon: 'i-lucide:shield-alert',
    iconColor: 'text-red-600',
    loading: vulnLoading.value,
    urgentCount: stats.value.urgent.vulnerable,
    nonUrgentCount: stats.value.nonUrgent.vulnerable,
    totalCount: stats.value.urgent.vulnerable + stats.value.nonUrgent.vulnerable,
    activeCount: stats.value.active.vulnerable,
  },
  {
    id: 'deprecated',
    label: $t('package.dependencies.insights.deprecated'),
    icon: 'i-lucide:octagon-alert',
    iconColor: 'text-purple-700 dark:text-purple-500',
    loading: vulnLoading.value,
    urgentCount: stats.value.urgent.deprecated,
    nonUrgentCount: stats.value.nonUrgent.deprecated,
    totalCount: stats.value.urgent.deprecated + stats.value.nonUrgent.deprecated,
    activeCount: stats.value.active.deprecated,
  },
  {
    id: 'replacement',
    label: $t('package.dependencies.insights.replacements_available'),
    icon: 'i-lucide:lightbulb',
    iconColor: 'text-amber-700 dark:text-amber-500',
    loading: replacementLoading.value,
    urgentCount: stats.value.urgent.replacement,
    nonUrgentCount: stats.value.nonUrgent.replacement,
    totalCount: stats.value.urgent.replacement + stats.value.nonUrgent.replacement,
    activeCount: stats.value.active.replacement,
  },
])

function isItemInteractive(item: InsightMetric): boolean {
  return props.interactive && item.totalCount > 0
}

const tooltipText = computed(() => {
  return `${$t('package.dependencies.insights.subtitle')} — ${$t('package.dependencies.insights.tooltip_urgent')} / ${$t('package.dependencies.insights.tooltip_other')}`
})

const hasDependencies = computed(() => props.sections.some(s => s.items.length > 0))
</script>

<template>
  <section v-if="hasDependencies" id="dependency-health" class="w-full py-4 mt-6">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-1.5">
        <h2 class="text-fg-muted uppercase">
          {{ $t('package.dependencies.insights.title') }}
        </h2>
        <TooltipApp :text="tooltipText" position="bottom">
          <span class="i-lucide:info w-3.5 h-3.5" aria-hidden="true" />
        </TooltipApp>
      </div>

      <button
        v-if="interactive && selectedInsights.length > 0"
        type="button"
        class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg font-mono transition-colors duration-200 cursor-pointer"
        @click="selectedInsights = []"
      >
        <span class="i-lucide:x w-3 h-3" aria-hidden="true" />
        <span>{{ $t('filters.clear_all') }}</span>
      </button>
    </div>

    <div
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-3 gap-x-4 border-y-border border-y py-3"
    >
      <component
        :is="isItemInteractive(item) ? 'button' : 'div'"
        v-for="item in metrics"
        :key="item.id"
        :type="isItemInteractive(item) ? 'button' : undefined"
        class="py-1.5 px-2 rounded-md text-start transition-colors duration-200"
        :class="[
          isItemInteractive(item)
            ? 'focus-visible:(outline-2 outline-accent/70 outline-offset-1) hover:bg-bg-subtle cursor-pointer'
            : '',
          isItemInteractive(item) && selectedInsights.includes(item.id)
            ? 'bg-bg-muted ring-1 ring-border-hover'
            : '',
        ]"
        :aria-pressed="isItemInteractive(item) ? selectedInsights.includes(item.id) : undefined"
        :aria-label="
          isItemInteractive(item)
            ? selectedInsights.includes(item.id)
              ? $t('package.dependencies.insights.clear_filter', { filter: item.label })
              : $t('package.dependencies.insights.filter_by', { filter: item.label })
            : undefined
        "
        @click="isItemInteractive(item) ? toggleInsight(item.id) : undefined"
      >
        <span
          class="text-xs text-fg-muted lowercase flex items-center justify-start gap-1.5 w-full min-w-0"
        >
          <span class="flex items-center gap-1.5 truncate min-w-0">
            <span
              v-if="interactive && item.totalCount > 0"
              aria-hidden="true"
              class="w-3.5 h-3.5 border rounded shrink-0 flex items-center justify-center transition-colors pointer-events-none"
              :class="
                selectedInsights.includes(item.id)
                  ? 'bg-fg border-fg text-bg'
                  : 'border-border bg-bg-muted'
              "
            >
              <span v-if="selectedInsights.includes(item.id)" class="i-lucide:check w-2.5 h-2.5" />
            </span>
            <span class="truncate">{{ item.label }}</span>
          </span>
          <span :class="[item.icon, item.iconColor, 'w-3.5 h-3.5 shrink-0']" aria-hidden="true" />
        </span>
        <span class="text-sm font-mono mt-1 block">
          <template v-if="showSkeleton || item.loading">
            <span class="inline-flex items-center gap-1 text-fg-subtle">
              <span class="i-svg-spinners:ring-resize w-3 h-3" aria-hidden="true" />
            </span>
          </template>
          <template v-else>
            <span class="flex text-sm items-center text-fg-subtle gap-1">
              <span
                v-if="item.totalCount === 0"
                class="i-lucide:check w-3 h-3"
                aria-hidden="true"
              />
              <span class="tabular-nums" :class="item.urgentCount > 0 ? 'text-fg font-medium' : ''">
                {{ item.urgentCount }}
              </span>
              <template v-if="item.totalCount > 0">
                <span class="px-0.5">/</span>
                <span class="tabular-nums text-fg-muted">
                  {{ item.totalCount }}
                </span>
              </template>
            </span>
          </template>
        </span>
      </component>
    </div>
  </section>
</template>
