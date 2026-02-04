<script setup lang="ts">
defineProps<{
  keywords?: string[]
}>()
</script>
<template>
  <CollapsibleSection v-if="keywords?.length" :title="$t('package.keywords_title')" id="keywords">
    <ul class="flex flex-wrap gap-1.5 list-none m-0 p-1">
      <li v-for="keyword in keywords.slice(0, 15)" :key="keyword">
        <TagLink :to="{ name: 'search', query: { q: `keywords:${keyword}` } }">
          {{ keyword }}
        </TagLink>
      </li>
    </ul>
  </CollapsibleSection>
</template>
