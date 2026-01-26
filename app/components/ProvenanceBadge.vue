<script setup lang="ts">
defineProps<{
  /** Provider ID (e.g., "github", "gitlab") */
  provider?: string
  /** Package name for linking to npmjs.com provenance page */
  packageName?: string
  /** Package version for linking */
  version?: string
  /** Whether to show as compact (icon only) or full (with text) */
  compact?: boolean
}>()

const providerLabels: Record<string, string> = {
  github: 'GitHub Actions',
  gitlab: 'GitLab CI',
}
</script>

<template>
  <a
    v-if="packageName && version"
    :href="`https://www.npmjs.com/package/${packageName}/v/${version}#provenance`"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center justify-center gap-1 text-xs font-mono text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
    :title="
      provider
        ? `Verified: published via ${providerLabels[provider] ?? provider}`
        : 'Verified provenance'
    "
  >
    <span
      class="i-solar-shield-check-outline shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">verified</span>
  </a>
  <span
    v-else
    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted"
    :title="
      provider
        ? `Verified: published via ${providerLabels[provider] ?? provider}`
        : 'Verified provenance'
    "
  >
    <span
      class="i-solar-shield-check-outline shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">verified</span>
  </span>
</template>
