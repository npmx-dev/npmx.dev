<script setup lang="ts">
defineProps<{
  keywords?: string[]
}>()

const { model } = useGlobalSearch()
</script>
<template>
  <CollapsibleSection v-if="keywords?.length" :title="$t('package.keywords_title')" id="keywords">
    <ul class="flex flex-wrap gap-1.5 list-none m-0 p-1">
      <li v-for="keyword in keywords.slice(0, 15)" :key="keyword">
        <LinkBase
          variant="button-secondary"
          size="small"
          :to="{ name: 'search', query: { q: `keyword:${keyword}` } }"
          @click="model = `keyword:${keyword}`"
        >
          {{ keyword }}
        </LinkBase>
      </li>
    </ul>
  </CollapsibleSection>
</template>
