<script setup lang="ts">
const props = defineProps<{
  /** Provider ID (e.g., "github", "gitlab") */
  provider?: string
  /** Package name for linking to npmjs.com provenance page */
  packageName?: string
  /** Package version for linking */
  version?: string
  /** Whether to show as compact (icon only) or full (with text) */
  compact?: boolean
  /** Whether to render as a link (defaults to true when packageName and version are provided) */
  linked?: boolean
}>()

const providerLabels: Record<string, string> = {
  github: 'GitHub Actions',
  gitlab: 'GitLab CI',
}

const title = computed(() =>
  props.provider
    ? $t('badges.provenance.verified_via', {
        provider: providerLabels[props.provider] ?? props.provider,
      })
    : $t('badges.provenance.verified_title'),
)
</script>

<template>
  <a
    v-if="packageName && version && linked !== false"
    :href="`https://www.npmjs.com/package/${packageName}/v/${version}#provenance`"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center justify-center gap-1 text-xs font-mono text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
    :title="title"
  >
    <span class="i-lucide-shield-check shrink-0" :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'" />
    <span v-if="!compact" class="sr-only sm:not-sr-only">{{
      $t('badges.provenance.verified')
    }}</span>
  </a>
  <span
    v-else
    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted"
    :title="title"
  >
    <span class="i-lucide-shield-check shrink-0" :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'" />
    <span v-if="!compact" class="sr-only sm:not-sr-only">{{
      $t('badges.provenance.verified')
    }}</span>
  </span>
</template>
