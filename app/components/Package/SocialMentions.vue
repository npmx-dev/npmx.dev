<script lang="ts" setup>
import type { PackageSocialMentions } from '#shared/types/social'

const props = defineProps<{
  packageName: string
}>()

const compactNumberFormatter = useCompactNumberFormatter()

const { data: mentionsData, execute: fetchMentions } = useLazyFetch<PackageSocialMentions>(
  () => `/api/social/mentions/${props.packageName}`,
  {
    default: () => ({ totalMentions: 0 }),
    server: false,
    immediate: false,
  },
)

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
// Bluesky search has no OR, so search by package name to cover both npmx.dev and npmjs.com links.
const searchUrl = computed(
  () => `https://bsky.app/search?q=${encodeURIComponent(`"${props.packageName}"`)}`,
)
const label = computed(() =>
  $t(
    'package.social_mentions.label',
    { count: compactNumberFormatter.value.format(totalMentions.value) },
    totalMentions.value,
  ),
)
</script>

<template>
  <LinkBase
    variant="button-secondary"
    classicon="i-lucide:message-circle"
    :to="searchUrl"
    data-testid="social-mentions"
    class="min-w-36"
  >
    {{ label }}
  </LinkBase>
</template>
