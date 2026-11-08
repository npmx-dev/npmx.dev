<script setup lang="ts">
import type { CollectionSummary } from '#shared/types/social'

defineProps<{
  collection: CollectionSummary
  /** 3 by default, for lists under an h2 */
  headingLevel?: 2 | 3
}>()
</script>

<template>
  <NuxtLink
    :to="{
      name: 'collections-identifier-rkey',
      params: { identifier: collection.handle, rkey: collection.rkey },
    }"
    class="block h-full"
  >
    <BaseCard class="flex h-full flex-col gap-2 min-w-0">
      <component
        :is="`h${headingLevel ?? 3}`"
        class="font-mono text-base font-medium truncate min-w-0"
        :title="collection.name"
      >
        {{ collection.name }}
      </component>
      <p class="font-mono text-sm text-fg-muted truncate">
        {{ $t('collections.by', { handle: collection.handle }) }}
      </p>
      <p v-if="collection.description" class="text-sm text-fg-muted line-clamp-2">
        {{ collection.description }}
      </p>
      <p class="mt-auto font-mono text-xs text-fg-subtle">
        {{
          $t('collections.item_count', { count: $n(collection.itemCount) }, collection.itemCount)
        }}
      </p>
    </BaseCard>
  </NuxtLink>
</template>
