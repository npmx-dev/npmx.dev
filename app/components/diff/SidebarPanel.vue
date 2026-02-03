<script setup lang="ts">
import type { CompareResponse, FileChange } from '#shared/types'

const props = defineProps<{
  compare: CompareResponse
  groupedDeps: Map<string, CompareResponse['dependencyChanges']>
  allChanges: FileChange[]
  showSettings?: boolean
}>()

const emit = defineEmits<{
  'file-select': [file: FileChange]
}>()

const selectedFile = defineModel<FileChange | null>('selectedFile', { default: null })
const fileFilter = defineModel<'all' | 'added' | 'removed' | 'modified'>('fileFilter', {
  default: 'all',
})

const sectionOrder = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
const { t } = useI18n()
const sectionMeta = computed<Record<string, { label: string; icon: string }>>(() => ({
  dependencies: { label: t('compare.dependencies'), icon: 'i-carbon-cube' },
  devDependencies: { label: t('compare.dev_dependencies'), icon: 'i-carbon-tools' },
  peerDependencies: { label: t('compare.peer_dependencies'), icon: 'i-carbon-user-multiple' },
  optionalDependencies: { label: t('compare.optional_dependencies'), icon: 'i-carbon-help' },
}))

const sectionList = computed(() => {
  const entries = Array.from(props.groupedDeps.entries())
  return entries
    .map(([key, changes]) => ({
      key,
      changes,
      label: sectionMeta.value[key]?.label ?? key,
      icon: sectionMeta.value[key]?.icon ?? 'i-carbon-cube',
      order: sectionOrder.indexOf(key) === -1 ? sectionOrder.length + 1 : sectionOrder.indexOf(key),
    }))
    .sort((a, b) => a.order - b.order)
})

const filteredChanges = computed(() => {
  if (fileFilter.value === 'all') return props.allChanges
  return props.allChanges.filter(f => f.type === fileFilter.value)
})

function getSemverBadgeClass(semverDiff: string | null | undefined): string {
  switch (semverDiff) {
    case 'major':
      return 'bg-red-500/10 text-red-500'
    case 'minor':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'patch':
      return 'bg-green-500/10 text-green-500'
    case 'prerelease':
      return 'bg-purple-500/10 text-purple-500'
    default:
      return 'bg-bg-muted text-fg-subtle'
  }
}

function handleFileSelect(file: FileChange) {
  selectedFile.value = file
  emit('file-select', file)
}
</script>

<template>
  <div class="flex flex-col min-h-0">
    <!-- Summary section -->
    <div class="border-b border-border shrink-0">
      <div class="px-3 py-2.5 border-b border-border">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs font-medium flex items-center gap-1.5">
            <span class="i-lucide-lightbulb w-3.5 h-3.5" />
            {{ $t('compare.summary') }}
          </span>
          <div class="flex items-center gap-3 font-mono text-[10px]">
            <span class="flex items-center gap-1">
              <span class="text-green-500">+{{ compare.stats.filesAdded }}</span>
              <span class="text-fg-subtle">/</span>
              <span class="text-red-500">-{{ compare.stats.filesRemoved }}</span>
              <span class="text-fg-subtle">/</span>
              <span class="text-yellow-500">~{{ compare.stats.filesModified }}</span>
            </span>
            <span v-if="compare.dependencyChanges.length > 0" class="text-fg-muted">
              {{ $t('compare.deps_count', { count: compare.dependencyChanges.length }) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="compare.meta.warnings?.length"
        class="px-3 py-2 bg-yellow-500/5 border-b border-border"
      >
        <div class="flex items-start gap-2">
          <span class="i-carbon-warning w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
          <div class="text-[10px] text-fg-muted">
            <p v-for="warning in compare.meta.warnings" :key="warning">{{ warning }}</p>
          </div>
        </div>
      </div>

      <div v-if="compare.dependencyChanges.length > 0" class="px-3 py-2.5 space-y-2">
        <details v-for="section in sectionList" :key="section.key" class="group">
          <summary
            class="cursor-pointer list-none flex items-center gap-2 text-xs font-medium mb-2 hover:text-fg transition-colors"
          >
            <span
              class="i-carbon-chevron-right w-3.5 h-3.5 transition-transform group-open:rotate-90"
            />
            <span :class="section.icon" class="w-3.5 h-3.5" />
            {{ section.label }} ({{ section.changes.length }})
          </summary>

          <div class="space-y-1 ml-5 max-h-40 overflow-y-auto">
            <div
              v-for="dep in section.changes"
              :key="dep.name"
              class="flex items-center gap-2 text-xs py-0.5"
            >
              <span
                :class="[
                  'w-3 h-3 shrink-0',
                  dep.type === 'added'
                    ? 'i-carbon-add-alt text-green-500'
                    : dep.type === 'removed'
                      ? 'i-carbon-subtract-alt text-red-500'
                      : 'i-carbon-arrows-horizontal text-yellow-500',
                ]"
              />

              <NuxtLink
                :to="`/${dep.name}`"
                class="font-mono hover:text-fg transition-colors truncate min-w-0"
              >
                {{ dep.name }}
              </NuxtLink>

              <div
                class="flex items-center gap-1.5 text-fg-muted font-mono text-[10px] ml-auto shrink-0"
              >
                <span
                  v-if="dep.from"
                  :class="{ 'line-through opacity-50': dep.type === 'updated' }"
                >
                  {{ dep.from }}
                </span>
                <span v-if="dep.type === 'updated'" class="i-carbon-arrow-right w-2.5 h-2.5" />
                <span v-if="dep.to">{{ dep.to }}</span>
              </div>

              <span
                v-if="dep.semverDiff"
                class="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                :class="getSemverBadgeClass(dep.semverDiff)"
              >
                {{ dep.semverDiff }}
              </span>
            </div>
          </div>
        </details>
      </div>

      <div
        v-if="compare.dependencyChanges.length === 0 && !compare.meta.warnings?.length"
        class="px-3 py-2 text-[10px] text-fg-muted text-center"
      >
        {{ $t('compare.no_dependency_changes') }}
      </div>
    </div>

    <!-- File browser -->
    <details class="flex-1 flex flex-col open:flex-1 group min-h-0" open>
      <summary
        class="border-b border-border px-3 py-2 shrink-0 cursor-pointer list-none flex items-center justify-between gap-2"
      >
        <span class="text-xs font-medium flex items-center gap-1.5">
          <span class="i-carbon-document w-3.5 h-3.5" />
          {{ $t('compare.file_changes') }}
        </span>
        <span class="flex items-center gap-2">
          <select
            v-model="fileFilter"
            class="text-[10px] px-2 py-1 bg-bg-subtle border border-border rounded font-mono cursor-pointer hover:border-border-hover transition-colors"
          >
            <option value="all">
              {{ $t('compare.file_filter_option.all', { count: allChanges.length }) }}
            </option>
            <option value="added">
              {{ $t('compare.file_filter_option.added', { count: compare.stats.filesAdded }) }}
            </option>
            <option value="removed">
              {{ $t('compare.file_filter_option.removed', { count: compare.stats.filesRemoved }) }}
            </option>
            <option value="modified">
              {{
                $t('compare.file_filter_option.modified', { count: compare.stats.filesModified })
              }}
            </option>
          </select>
          <span
            class="i-carbon-chevron-right w-3.5 h-3.5 transition-transform group-open:rotate-90"
          />
        </span>
      </summary>

      <div class="flex-1 overflow-y-auto min-h-0">
        <div v-if="filteredChanges.length === 0" class="p-8 text-center text-xs text-fg-muted">
          {{
            fileFilter === 'all'
              ? $t('compare.no_files_all')
              : $t('compare.no_files_filtered', { filter: $t(`compare.filter.${fileFilter}`) })
          }}
        </div>

        <DiffFileTree
          v-else
          :files="filteredChanges"
          :selected-path="selectedFile?.path ?? null"
          @select="handleFileSelect"
        />
      </div>
    </details>
  </div>
</template>
