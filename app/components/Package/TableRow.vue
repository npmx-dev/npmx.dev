<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { NpmSearchResult } from '#shared/types/npm-registry'
import type { ColumnConfig, StructuredFilters } from '#shared/types/preferences'
import { getVulnerableDepInfo, getDeprecatedDepInfo } from '~/utils/npm/problematic-dependencies'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'

const props = defineProps<{
  result: NpmSearchResult
  columns: ColumnConfig[]
  index?: number
  filters?: StructuredFilters
  insights?: PackageDependencyInsights
  to?: RouteLocationRaw | string
}>()

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()

const pkg = computed(() => props.result.package)
const insights = computed(() => props.insights)

const updatedDate = computed(() => props.result.package.date)
const { isPackageSelected, togglePackageSelection, canSelectMore } = usePackageSelection()
const isSelected = computed<boolean>(() => {
  return isPackageSelected(props.result.package.name)
})

function isColumnVisible(id: string): boolean {
  return props.columns.find(c => c.id === id)?.visible ?? false
}

const packageUrl = computed(() => props.to ?? packageRoute(pkg.value.name))

const allMaintainersText = computed(() => {
  if (!pkg.value.maintainers?.length) return ''
  return pkg.value.maintainers.map(m => m.name || m.email).join(', ')
})

const standaloneReplacementRes = useModuleReplacement(() => props.result.package.name)
const standaloneDepAnalysisRes = useDependencyAnalysis(
  () => props.result.package.name,
  () => props.result.package.version,
)

const hasReplacement = computed(() => {
  if (insights.value) {
    return !!unref(insights.value.replacementDeps)?.[props.result.package.name]
  }
  return !!standaloneReplacementRes.data.value?.replacement
})

const effectiveVulnTree = computed(() => {
  if (insights.value) {
    return unref(insights.value.vulnTree)
  }
  return standaloneDepAnalysisRes.data.value ?? undefined
})

const packageTextColorClass = computed(() => {
  const dependencyName = pkg.value.name
  if (getVulnerableDepInfo(dependencyName, effectiveVulnTree.value)) return 'text-red-600'
  if (
    getDeprecatedDepInfo(dependencyName, effectiveVulnTree.value, props.result.package.deprecated)
  )
    return 'text-purple-700 dark:text-purple-500'
  if (hasReplacement.value) return 'text-amber-700 dark:text-amber-500'

  return 'text-fg hover:text-accent-fallback'
})

const compactNumberFormatter = useCompactNumberFormatter()

const { selectable } = usePackageSelectionContext()
</script>

<template>
  <tr
    class="group relative scale-100 [clip-path:inset(0)] border-b border-border hover:bg-bg-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none focus:bg-bg-muted focus-within:bg-bg-muted"
  >
    <td class="ps-3" v-if="selectable">
      <PackageSelectionCheckbox
        :package-name="result.package.name"
        :disabled="!canSelectMore && !isSelected"
        :checked="isSelected"
        @change="togglePackageSelection"
        class="relative z-10"
      />
    </td>
    <!-- Name (always visible) -->
    <td class="py-2 px-3 inline-flex items-center gap-2">
      <NuxtLink
        :to="packageUrl"
        class="row-link font-mono text-sm transition-colors duration-200 inline-flex items-center gap-2 min-w-0 after:content-[''] after:absolute after:inset-0"
        :class="packageTextColorClass"
        :data-result-index="index"
      >
        <span class="i-simple-icons:npm w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate" dir="ltr">{{ pkg.name }}</span>
      </NuxtLink>
      <slot name="status-indicators" :insights="insights">
        <DependenciesStatusIndicators
          :name="pkg.name"
          :deprecated="result.package.deprecated"
          :has-replacement="hasReplacement"
          :vuln-tree="effectiveVulnTree"
          :insights="insights"
          class="relative z-10"
        />
      </slot>
    </td>

    <!-- Version -->
    <td
      v-if="isColumnVisible('version')"
      class="py-2 px-3 font-mono text-xs text-fg-subtle relative z-10"
    >
      <slot name="version" :version="pkg.version">
        <span dir="ltr">{{ pkg.version }}</span>
      </slot>
    </td>

    <!-- Description -->
    <td
      v-if="isColumnVisible('description')"
      class="py-2 px-3 text-sm text-fg-muted max-w-xs truncate"
    >
      {{ stripHtmlTags(decodeHtmlEntities(pkg.description || '')) || '-' }}
    </td>

    <!-- Downloads -->
    <td
      v-if="isColumnVisible('downloads')"
      class="py-2 px-3 font-mono text-xs text-fg-muted text-end tabular-nums"
    >
      {{
        result.downloads?.weekly !== undefined
          ? compactNumberFormatter.format(result.downloads.weekly)
          : '-'
      }}
    </td>

    <!-- Updated -->
    <td
      v-if="isColumnVisible('updated')"
      class="py-2 px-3 font-mono text-end text-xs text-fg-muted"
    >
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
    <td v-if="isColumnVisible('maintainers')" class="py-2 px-3 text-sm text-fg-muted text-end">
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
            :to="{
              name: '~username',
              params: { username: maintainer.username || maintainer.name || '' },
            }"
            class="relative z-10 hover:text-accent-fallback transition-colors duration-200"
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
    <td v-if="isColumnVisible('keywords')" class="py-2 px-3 text-end">
      <div
        v-if="pkg.keywords?.length"
        class="relative z-10 flex flex-wrap gap-1 justify-end"
        :aria-label="$t('package.card.keywords')"
      >
        <ButtonBase
          v-for="keyword in pkg.keywords.slice(0, 3)"
          :key="keyword"
          size="sm"
          :aria-pressed="props.filters?.keywords?.includes(keyword)"
          :title="`Filter by ${keyword}`"
          @click.stop="emit('clickKeyword', keyword)"
        >
          {{ keyword }}
        </ButtonBase>
        <span
          v-if="pkg.keywords.length > 3"
          class="text-fg-subtle text-xs"
          :title="pkg.keywords.slice(3).join(', ')"
        >
          +{{ pkg.keywords.length - 3 }}
        </span>
      </div>
      <span v-else class="text-fg-subtle">-</span>
    </td>

    <!-- Security -->
    <td v-if="isColumnVisible('security')" class="py-2 px-3">
      <span v-if="result.flags?.insecure" class="text-syntax-kw">
        <span class="i-lucide:circle-alert w-4 h-4" aria-hidden="true" />
        <span class="sr-only">{{ $t('filters.table.security_warning') }}</span>
      </span>
      <span v-else-if="result.flags !== undefined" class="text-provider-nuxt">
        <span class="i-lucide:check w-4 h-4" aria-hidden="true" />
        <span class="sr-only">{{ $t('filters.table.secure') }}</span>
      </span>
      <span v-else class="text-fg-subtle"> - </span>
    </td>
  </tr>
</template>

<style scoped>
.row-link {
  &:focus-visible {
    outline: 2px solid var(--color-fg);
    outline-offset: -2px;
  }
}
</style>
