<script setup lang="ts">
interface HealthScoreDimension {
  score: number
  weight: number
}

interface HealthScoreResponse {
  package: string
  version: string
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: {
    maintenance: HealthScoreDimension
    quality: HealthScoreDimension
    security: HealthScoreDimension
    popularity: HealthScoreDimension
  }
  analyzedAt: string
}

const props = defineProps<{
  packageName: string
  version?: string
}>()

const { data, status } = useFetch<HealthScoreResponse>(
  () => {
    const base = `https://npm-pulse.vercel.app/api/v1/score/${props.packageName}`
    return props.version ? `${base}?version=${props.version}` : base
  },
  {
    key: () => `health-score-${props.packageName}-${props.version ?? 'latest'}`,
    server: false,
    lazy: true,
  },
)

const isLoading = computed(() => status.value === 'pending' || status.value === 'idle')
const isError = computed(() => status.value === 'error')

function gradeColor(grade: string | undefined): string {
  switch (grade) {
    case 'A':
      return 'text-emerald-500'
    case 'B':
      return 'text-lime-500'
    case 'C':
      return 'text-amber-500'
    case 'D':
      return 'text-orange-500'
    case 'F':
      return 'text-red-500'
    default:
      return 'text-fg-subtle'
  }
}

function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-lime-500'
  if (score >= 40) return 'bg-amber-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

const dimensions = computed(() => {
  if (!data.value?.dimensions) return []
  const d = data.value.dimensions
  return [
    {
      key: 'maintenance',
      label: $t('package.health_score.dimension_maintenance'),
      score: d.maintenance?.score ?? 0,
      weight: d.maintenance?.weight ?? 0,
    },
    {
      key: 'quality',
      label: $t('package.health_score.dimension_quality'),
      score: d.quality?.score ?? 0,
      weight: d.quality?.weight ?? 0,
    },
    {
      key: 'security',
      label: $t('package.health_score.dimension_security'),
      score: d.security?.score ?? 0,
      weight: d.security?.weight ?? 0,
    },
    {
      key: 'popularity',
      label: $t('package.health_score.dimension_popularity'),
      score: d.popularity?.score ?? 0,
      weight: d.popularity?.weight ?? 0,
    },
  ]
})
</script>

<template>
  <CollapsibleSection
    :title="$t('package.health_score.title')"
    :subtitle="$t('package.health_score.algorithm_subtitle')"
    :is-loading="isLoading"
    icon="i-lucide:activity"
    id="health-score"
  >
    <!-- Error state -->
    <div v-if="isError" class="flex items-center gap-2 text-fg-subtle text-sm">
      <span class="i-lucide:circle-alert w-4 h-4" aria-hidden="true" />
      <span>{{ $t('package.health_score.error') }}</span>
    </div>

    <!-- Score display -->
    <div v-else-if="data" class="space-y-3">
      <!-- Score + grade -->
      <div class="flex items-center gap-3">
        <TooltipApp :text="$t('package.health_score.score_tooltip')" strategy="fixed">
          <div class="flex items-baseline gap-1 cursor-default" tabindex="0">
            <span class="font-mono text-2xl font-bold text-fg leading-none">{{ data.score }}</span>
            <span class="text-xs text-fg-subtle">/100</span>
          </div>
        </TooltipApp>

        <TooltipApp
          :text="$t('package.health_score.grade_tooltip', { grade: data.grade })"
          strategy="fixed"
        >
          <TagStatic
            tabindex="0"
            :class="gradeColor(data.grade)"
            class="font-mono font-bold text-sm! min-w-8 justify-center"
            variant="ghost"
          >
            {{ data.grade }}
          </TagStatic>
        </TooltipApp>
      </div>

      <!-- Dimension bars -->
      <ul
        class="space-y-2 list-none m-0 p-0"
        :aria-label="$t('package.health_score.dimensions_label')"
      >
        <li v-for="dim in dimensions" :key="dim.key">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-xs text-fg-subtle">
              {{ dim.label }}
              <span class="text-fg-muted">({{ dim.weight }}%)</span>
            </span>
            <span class="font-mono text-xs text-fg-muted">{{ dim.score }}</span>
          </div>
          <div
            class="h-1.5 w-full rounded-full overflow-hidden"
            style="background-color: var(--border)"
            role="progressbar"
            :aria-valuenow="dim.score"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${dim.label}: ${dim.score}/100`"
          >
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="scoreBarColor(dim.score)"
              :style="{ width: `${dim.score}%` }"
            />
          </div>
        </li>
      </ul>

      <!-- Footer: link to npm Pulse (homepage, not raw JSON) -->
      <a
        href="https://npm-pulse.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors duration-150 underline underline-offset-2 decoration-fg-subtle/40"
      >
        {{ $t('package.health_score.powered_by') }}
        <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
      </a>
    </div>
  </CollapsibleSection>
</template>
