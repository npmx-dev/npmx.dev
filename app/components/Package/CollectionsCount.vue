<script setup lang="ts">
const props = defineProps<{
  packageName: string
}>()

const compactNumberFormatter = useCompactNumberFormatter()

const { data } = useFetch<{ total?: number }>('/api/social/collections/containing', {
  query: computed(() => ({ subject: PACKAGE_SUBJECT_REF(props.packageName), limit: 0 })),
  default: () => ({ total: 0 }),
  server: false,
})
const total = computed(() => data.value?.total ?? 0)
</script>

<template>
  <LinkBase
    v-if="total > 0"
    variant="button-secondary"
    classicon="i-lucide:library"
    :to="{ name: 'collections', query: { package: packageName } }"
    data-testid="package-collections-count"
  >
    {{ $t('collections.in_collections', { count: compactNumberFormatter.format(total) }, total) }}
  </LinkBase>
</template>
