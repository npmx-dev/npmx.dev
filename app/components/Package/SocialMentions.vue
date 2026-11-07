<script lang="ts" setup>
import type { PackageSocialMentions } from '#shared/types/social'
import { PACKAGE_SUBJECT_REF } from '#shared/utils/constants'

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
// Search the exact npmx.dev URL to avoid noisy matches on package names like "react".
const searchUrl = computed(
  () => `https://bsky.app/search?q=${encodeURIComponent(PACKAGE_SUBJECT_REF(props.packageName))}`,
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
