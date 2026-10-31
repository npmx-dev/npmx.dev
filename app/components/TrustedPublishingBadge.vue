<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Provider ID (e.g., "github", "gitlab") */
    provider?: string
    /** Whether to show as compact (icon only) or full (with text) */
    compact?: boolean
    /** Whether to render as a link to the npm trusted publishing docs */
    linked?: boolean
  }>(),
  { linked: true },
)

const trustedPublishingDocs = 'https://docs.npmjs.com/trusted-publishers'

const title = computed(() =>
  props.provider
    ? $t('badges.trusted_publishing.title_via', { provider: getCiProviderLabel(props.provider) })
    : $t('badges.trusted_publishing.title'),
)
</script>

<template>
  <a
    v-if="props.linked !== false"
    :href="trustedPublishingDocs"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center justify-center gap-1 text-xs font-mono text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
    :title="title"
  >
    <span
      class="i-lucide:shield-check shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
      aria-hidden="true"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">
      {{ $t('badges.trusted_publishing.label') }}
    </span>
  </a>
  <span
    v-else
    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted"
    :title="title"
  >
    <span
      class="i-lucide:shield-check shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
      aria-hidden="true"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">
      {{ $t('badges.trusted_publishing.label') }}
    </span>
  </span>
</template>
