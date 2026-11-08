<script setup lang="ts">
import type { CollectionItemView } from '#shared/types/social'

defineProps<{
  items: CollectionItemView[]
}>()
</script>

<template>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">
    <li v-for="(item, index) in items" :key="`${index}:${item.subjectRef}`">
      <!-- Package -->
      <div
        v-if="item.kind === 'package'"
        class="flex flex-col gap-1 rounded-lg border border-border bg-bg-subtle p-4"
        :class="{ 'border-dashed': !item.resolved }"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
          <LinkBase
            v-if="item.resolved"
            :to="packageRoute(item.packageName)"
            class="font-mono font-medium truncate min-w-0"
          >
            {{ item.packageName }}
          </LinkBase>
          <span v-else class="font-mono font-medium line-through truncate min-w-0">
            {{ item.packageName }}
          </span>
          <span v-if="!item.resolved" class="font-mono text-xs text-fg-muted">
            {{ $t('collections.package_unresolved') }}
          </span>
        </div>
        <p v-if="item.note" class="text-sm text-fg-muted">{{ item.note }}</p>
      </div>

      <!-- Included collection: a link, not expanded -->
      <div
        v-else-if="item.kind === 'collection'"
        class="flex flex-col gap-1 rounded-lg border border-dashed border-border p-4"
      >
        <div v-if="item.collection" class="flex flex-col gap-1">
          <p class="font-mono text-xs uppercase tracking-wide text-fg-subtle">
            {{ $t('collections.includes') }}
          </p>
          <LinkBase
            :to="{
              name: 'collections-identifier-rkey',
              params: { identifier: item.collection.handle, rkey: item.collection.rkey },
            }"
            class="font-mono font-medium"
          >
            {{ item.collection.name }}
          </LinkBase>
          <p class="font-mono text-sm text-fg-muted">
            {{ $t('collections.by', { handle: item.collection.handle }) }} ·
            {{
              $t(
                'collections.item_count',
                { count: $n(item.collection.itemCount) },
                item.collection.itemCount,
              )
            }}
          </p>
          <p v-if="item.note" class="text-sm text-fg-muted">{{ item.note }}</p>
        </div>
        <p v-else class="font-mono text-sm text-fg-subtle">
          {{ $t('collections.unavailable.unresolvable') }}
        </p>
      </div>

      <!-- Something we don't understand; show it so the author can fix it -->
      <div
        v-else
        class="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-bg-subtle p-4"
      >
        <span class="font-mono text-xs text-fg-muted">{{ $t('collections.unknown_item') }}</span>
        <span class="font-mono text-sm break-all">{{ item.subjectRef }}</span>
        <p v-if="item.note" class="text-sm text-fg-muted">{{ item.note }}</p>
      </div>
    </li>
  </ol>
</template>
