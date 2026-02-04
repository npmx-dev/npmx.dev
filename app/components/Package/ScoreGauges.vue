<script setup lang="ts">
const props = defineProps<{
  packageName: string
}>()

const { data: score, status } = usePackageScore(() => props.packageName)

const scoreMetrics = computed(() => {
  if (!score.value) return []
  return [
    {
      key: 'quality',
      value: score.value.detail.quality * 100,
      label: $t('package.scores.quality'),
    },
    {
      key: 'popularity',
      value: score.value.detail.popularity * 100,
      label: $t('package.scores.popularity'),
    },
    {
      key: 'maintenance',
      value: score.value.detail.maintenance * 100,
      label: $t('package.scores.maintenance'),
    },
  ]
})

function getScoreColor(percentage: number): string {
  if (percentage < 40) return 'oklch(0.55 0.12 25)'
  if (percentage < 70) return 'oklch(0.6 0.1 85)'
  return 'oklch(0.55 0.1 145)'
}
</script>

<template>
  <CollapsibleSection id="scores" :title="$t('package.scores.title')">
    <template #actions>
      <TooltipApp :text="$t('package.scores.source')">
        <span class="i-carbon:information w-3.5 h-3.5 text-fg-subtle" aria-hidden="true" />
      </TooltipApp>
    </template>
    <div v-if="status === 'pending'" class="flex flex-col gap-2">
      <div v-for="i in 3" :key="i" class="flex items-center gap-3">
        <SkeletonInline class="w-24 h-3" />
        <SkeletonInline class="flex-1 h-3 rounded-full" />
        <SkeletonInline class="w-8 h-3" />
      </div>
    </div>
    <div v-else-if="score" class="flex flex-col gap-2">
      <div v-for="metric in scoreMetrics" :key="metric.key" class="flex items-center gap-3">
        <span class="w-24 text-xs text-fg-subtle">{{ metric.label }}</span>
        <div class="flex-1 h-1.5 bg-border-subtle rounded-full overflow-hidden">
          <div
            class="h-full rounded-full"
            :style="{ width: `${metric.value}%`, background: getScoreColor(metric.value) }"
          />
        </div>
        <span class="w-8 text-xs font-mono text-fg-muted text-right">
          {{ Math.round(metric.value) }}%
        </span>
      </div>
    </div>
    <p v-else class="text-fg-subtle text-sm">{{ $t('package.scores.unavailable') }}</p>
  </CollapsibleSection>
</template>
