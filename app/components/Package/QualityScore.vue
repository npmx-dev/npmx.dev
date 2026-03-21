<script setup lang="ts">
const props = defineProps<{
  score: PackageScore
}>()

const categoryLabels: Record<ScoreCategory, string> = {
  documentation: $t('package.score.categories.documentation'),
  maintenance: $t('package.score.categories.maintenance'),
  types: $t('package.score.categories.types'),
  bestPractices: $t('package.score.categories.bestPractices'),
  security: $t('package.score.categories.security'),
}

const checkLabels: Record<string, string> = {
  'has-readme': $t('package.score.checks.has-readme'),
  'has-description': $t('package.score.checks.has-description'),
  'update-frequency': $t('package.score.checks.update-frequency'),
  'has-types': $t('package.score.checks.has-types'),
  'has-license': $t('package.score.checks.has-license'),
  'has-repository': $t('package.score.checks.has-repository'),
  'has-provenance': $t('package.score.checks.has-provenance'),
  'has-esm': $t('package.score.checks.has-esm'),
  'no-vulnerabilities': $t('package.score.checks.no-vulnerabilities'),
  'not-deprecated': $t('package.score.checks.not-deprecated'),
}

const categories = computed(() => {
  const order: ScoreCategory[] = ['documentation', 'maintenance', 'types', 'bestPractices', 'security']
  return order.map(cat => ({
    key: cat,
    label: categoryLabels[cat],
    checks: props.score.checks.filter(c => c.category === cat),
  }))
})

function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function ringColor(pct: number): string {
  if (pct >= 80) return 'stroke-green-600 dark:stroke-green-400'
  if (pct >= 50) return 'stroke-amber-600 dark:stroke-amber-400'
  return 'stroke-red-600 dark:stroke-red-400'
}

const circumference = 2 * Math.PI * 16
const dashOffset = computed(() => circumference - (props.score.percentage / 100) * circumference)

const scoreLabel = computed(() =>
  $t('package.score.subtitle', { earned: props.score.totalPoints, total: props.score.maxPoints }),
)
</script>

<template>
  <CollapsibleSection :title="$t('package.score.title')" id="quality-score">
    <template #actions>
      <div
        class="relative w-7 h-7 shrink-0"
        role="img"
        :aria-label="`${score.percentage}% — ${scoreLabel}`"
      >
        <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r="16" fill="none" class="stroke-border" stroke-width="3" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            :class="[ringColor(score.percentage), 'transition-[stroke-dashoffset] duration-500']"
            stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <span
          class="absolute inset-0 flex items-center justify-center text-3xs font-mono font-medium"
          :class="scoreColor(score.percentage)"
          aria-hidden="true"
        >
          {{ score.percentage }}
        </span>
      </div>
    </template>

    <!-- Checks by category -->
    <div class="space-y-3">
      <div v-for="cat in categories" :key="cat.key">
        <h3 class="text-2xs text-fg-subtle uppercase tracking-wider mb-1.5">
          {{ cat.label }}
        </h3>
        <ul class="space-y-1 list-none m-0 p-0">
          <li
            v-for="check in cat.checks"
            :key="check.id"
            class="flex items-start gap-2 text-sm py-0.5"
          >
            <span
              class="w-4 h-4 shrink-0 mt-0.5"
              :class="
                check.points === check.maxPoints
                  ? 'i-lucide:check text-green-600 dark:text-green-400'
                  : check.points > 0
                    ? 'i-lucide:minus text-amber-600 dark:text-amber-400'
                    : 'i-lucide:x text-fg-subtle'
              "
              aria-hidden="true"
            />
            <span class="flex-1 text-fg-muted" :class="{ 'text-fg-subtle': check.points === 0 }">
              {{ checkLabels[check.id] }}
            </span>
            <span class="font-mono text-2xs text-fg-subtle shrink-0">
              {{ check.points }}/{{ check.maxPoints }}
            </span>
          </li>
        </ul>
      </div>
    </div>
  </CollapsibleSection>
</template>
