<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types/npm-registry'
import type { ColumnConfig } from '#shared/types/preferences'

const props = defineProps<{
  result: NpmSearchResult
  columns: ColumnConfig[]
  index?: number
}>()

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()

const pkg = computed(() => props.result.package)
const score = computed(() => props.result.score)

const updatedDate = computed(() => props.result.package.date)

function formatDownloads(count?: number): string {
  if (count === undefined) return '-'
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}

function formatScore(value?: number): string {
  if (value === undefined || value === 0) return '-'
  return Math.round(value * 100).toString()
}

function isColumnVisible(id: string): boolean {
  return props.columns.find(c => c.id === id)?.visible ?? false
}

const packageUrl = computed(() => `/package/${pkg.value.name}`)

const allMaintainersText = computed(() => {
  if (!pkg.value.maintainers?.length) return ''
  return pkg.value.maintainers.map(m => m.name || m.email).join(', ')
})
</script>

<template>
  <tr
    class="border-b border-border hover:bg-bg-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none focus:bg-bg-muted"
    tabindex="0"
    :data-result-index="index"
  >
    <!-- Name (always visible) -->
    <td class="py-2 px-3">
      <NuxtLink
        :to="packageUrl"
        class="font-mono text-sm text-fg hover:text-accent-muted transition-colors duration-200"
      >
        {{ pkg.name }}
      </NuxtLink>
    </td>

    <!-- Version -->
    <td v-if="isColumnVisible('version')" class="py-2 px-3 font-mono text-xs text-fg-subtle">
      {{ pkg.version }}
    </td>

    <!-- Description -->
    <td
      v-if="isColumnVisible('description')"
      class="py-2 px-3 text-sm text-fg-muted max-w-xs truncate"
    >
      {{ pkg.description || '-' }}
    </td>

    <!-- Downloads -->
    <td
      v-if="isColumnVisible('downloads')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{ formatDownloads(result.downloads?.weekly) }}
    </td>

    <!-- Updated -->
    <td v-if="isColumnVisible('updated')" class="py-2 px-3 font-mono text-xs text-fg-muted">
      <DateTime
        v-if="updatedDate"
        :datetime="updatedDate"
        year="numeric"
        month="short"
        day="numeric"
      />
      <span v-else>-</span>
    </td>

    <!-- Maintainers -->
    <td v-if="isColumnVisible('maintainers')" class="py-2 px-3 text-sm text-fg-muted">
      <span
        v-if="pkg.maintainers?.length"
        :title="pkg.maintainers.length > 3 ? allMaintainersText : undefined"
        :class="{ 'cursor-help': pkg.maintainers.length > 3 }"
      >
        <template
          v-for="(maintainer, idx) in pkg.maintainers.slice(0, 3)"
          :key="maintainer.username || maintainer.email"
        >
          <NuxtLink
            :to="`/~${maintainer.username || maintainer.name}`"
            class="hover:text-accent-muted transition-colors duration-200"
            @click.stop
            >{{ maintainer.username || maintainer.name || maintainer.email }}</NuxtLink
          ><span v-if="idx < Math.min(pkg.maintainers.length, 3) - 1">, </span>
        </template>
        <span v-if="pkg.maintainers.length > 3" class="text-fg-subtle">
          +{{ pkg.maintainers.length - 3 }}
        </span>
      </span>
      <span v-else class="text-fg-subtle">-</span>
    </td>

    <!-- Keywords -->
    <td v-if="isColumnVisible('keywords')" class="py-2 px-3">
      <div v-if="pkg.keywords?.length" class="flex flex-wrap gap-1">
        <button
          v-for="keyword in pkg.keywords.slice(0, 3)"
          :key="keyword"
          type="button"
          class="tag text-xs hover:bg-fg hover:text-bg hover:border-fg transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :title="`Filter by ${keyword}`"
          @click.stop="emit('clickKeyword', keyword)"
        >
          {{ keyword }}
        </button>
        <span v-if="pkg.keywords.length > 3" class="text-fg-subtle text-xs">
          +{{ pkg.keywords.length - 3 }}
        </span>
      </div>
      <span v-else class="text-fg-subtle">-</span>
    </td>

    <!-- Quality Score -->
    <td
      v-if="isColumnVisible('qualityScore')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{ formatScore(score?.detail?.quality) }}
    </td>

    <!-- Popularity Score -->
    <td
      v-if="isColumnVisible('popularityScore')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{ formatScore(score?.detail?.popularity) }}
    </td>

    <!-- Maintenance Score -->
    <td
      v-if="isColumnVisible('maintenanceScore')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{ formatScore(score?.detail?.maintenance) }}
    </td>

    <!-- Combined Score -->
    <td
      v-if="isColumnVisible('combinedScore')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{ formatScore(score?.final) }}
    </td>

    <!-- Security -->
    <td v-if="isColumnVisible('security')" class="py-2 px-3">
      <span v-if="result.flags?.insecure" class="text-syntax-kw">
        <span class="i-carbon-warning w-4 h-4" aria-hidden="true" />
        <span class="sr-only">{{ $t('filters.table.security_warning') }}</span>
      </span>
      <span v-else-if="result.flags !== undefined" class="text-provider-nuxt">
        <span class="i-carbon-checkmark w-4 h-4" aria-hidden="true" />
        <span class="sr-only">{{ $t('filters.table.secure') }}</span>
      </span>
      <span v-else class="text-fg-subtle"> - </span>
    </td>
  </tr>
</template>
