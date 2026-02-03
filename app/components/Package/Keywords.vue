<script setup lang="ts">
import { NuxtLink } from '#components'

defineProps<{
  keywords?: string[]
}>()
</script>
<template>
  <CollapsibleSection v-if="keywords?.length" :title="$t('package.keywords_title')" id="keywords">
    <ul class="flex flex-wrap gap-1.5 list-none m-0 p-0">
      <li v-for="keyword in keywords.slice(0, 15)" :key="keyword">
        <TagClickable :as="NuxtLink" :to="{ name: 'search', query: { q: `keywords:${keyword}` } }">
          {{ keyword }}
        </TagClickable>
      </li>
    </ul>
  </CollapsibleSection>
</template>
