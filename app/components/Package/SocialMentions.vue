<script lang="ts" setup>
import type { PackageSocialMentions } from '#shared/types/social'
import { packageSubjectRef, SOCIAL_MENTIONS_MAX } from '#shared/utils/constants'

const props = defineProps<{
  packageName: string
}>()

const compactNumberFormatter = useCompactNumberFormatter()

const {
  data: mentionsData,
  status,
  execute: fetchMentions,
} = useLazyFetch<PackageSocialMentions>(() => `/api/social/mentions/${props.packageName}`, {
  default: () => ({ totalMentions: 0, isCapped: false }),
  server: false,
  immediate: false,
})

// Client-only: this decorative stat should never block SSR.
if (import.meta.client) {
  watch(
    () => props.packageName,
    packageName => {
      if (packageName) fetchMentions()
    },
    { immediate: true },
  )
}

const totalMentions = computed(() => mentionsData.value?.totalMentions ?? 0)
const isCapped = computed(() => mentionsData.value?.isCapped ?? false)
const displayCount = computed(() =>
  isCapped.value
    ? `${SOCIAL_MENTIONS_MAX}+`
    : compactNumberFormatter.value.format(totalMentions.value),
)
const isLoading = computed(() => status.value === 'pending' || status.value === 'idle')
// Search the exact npmx.dev URL to avoid noisy matches on package names like "react".
const searchUrl = computed(
  () => `https://bsky.app/search?q=${encodeURIComponent(packageSubjectRef(props.packageName))}`,
)
const label = computed(() =>
  $t('package.social_mentions.label', { count: displayCount.value }, totalMentions.value),
)
</script>

<template>
  <LinkBase
    variant="button-secondary"
    classicon="i-lucide:message-circle"
    :to="searchUrl"
    :aria-label="isLoading ? $t('common.loading') : label"
    data-testid="social-mentions"
    class="min-w-36"
  >
    <span v-if="isLoading" class="i-svg-spinners:ring-resize w-3 h-3" aria-hidden="true" />
    <span v-else>{{ label }}</span>
  </LinkBase>
</template>
