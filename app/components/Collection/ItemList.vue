<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types'
import type { CollectionItemView, CollectionUnavailableReason } from '#shared/types/social'

const { packages } = defineProps<{
  items: CollectionItemView[]
  /** Card metadata by package name; a package without it shows as a plain row */
  packages?: ReadonlyMap<string, NpmSearchResult>
}>()

// Keyword buttons filter search results, which a collection doesn't have
function cardResult(packageName: string) {
  const result = packages?.get(packageName)
  return result && { ...result, package: { ...result.package, keywords: undefined } }
}

// Static keys so the i18n unused-key check can see them
const unavailableText = (reason: CollectionUnavailableReason | undefined) =>
  reason === 'hidden'
    ? $t('collections.unavailable.hidden')
    : $t('collections.unavailable.unresolvable')
</script>

<template>
  <ol class="m-0 flex list-none flex-col gap-3 p-0">
    <li v-for="(item, index) in items" :key="`${index}:${item.subjectRef}`">
      <!-- Package with card metadata -->
      <div v-if="item.kind === 'package' && item.resolved && cardResult(item.packageName)">
        <PackageCard :result="cardResult(item.packageName)!" heading-level="h2">
          <template v-if="item.note" #annotation>
            <!-- Stays beside the name while ~15rem remain, then wraps below -->
            <CollectionItemNote class="flex-1 basis-60">{{ item.note }}</CollectionItemNote>
          </template>
        </PackageCard>
      </div>

      <!-- Package without card metadata -->
      <div
        v-else-if="item.kind === 'package'"
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
        <CollectionItemNote v-if="item.note">{{ item.note }}</CollectionItemNote>
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
          <CollectionItemNote v-if="item.note">{{ item.note }}</CollectionItemNote>
        </div>
        <p v-else class="font-mono text-sm text-fg-subtle">
          {{ unavailableText(item.unavailableReason) }}
        </p>
      </div>

      <!-- Something we don't understand; show it so the author can fix it -->
      <div
        v-else
        class="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-bg-subtle p-4"
      >
        <span class="font-mono text-xs text-fg-muted">{{ $t('collections.unknown_item') }}</span>
        <span class="font-mono text-sm break-all">{{ item.subjectRef }}</span>
        <CollectionItemNote v-if="item.note">{{ item.note }}</CollectionItemNote>
      </div>
    </li>
  </ol>
</template>
