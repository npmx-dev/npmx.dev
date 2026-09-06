<script setup lang="ts">
import type {
  DependencySortOption,
  PackageDependencySection,
} from '#shared/types/package-dependencies'
import type { ColumnConfig, ColumnId, ViewMode } from '#shared/types/preferences'

const props = defineProps<{
  filter: string
  sort: DependencySortOption
  viewMode: ViewMode
  columns?: ColumnConfig[]
  filteredCount: number
  totalCount: number
  sections?: PackageDependencySection[]
  activeSection?: string
  activeSections?: string[]
}>()

const emit = defineEmits<{
  'update:filter': [value: string]
  'update:sort': [value: DependencySortOption]
  'update:viewMode': [value: ViewMode]
  'update:activeSection': [value: string]
  'update:activeSections': [value: string[]]
  'toggleColumn': [columnId: ColumnId]
  'resetColumns': []
}>()

const { t } = useI18n()

const filterValue = computed({
  get: () => props.filter,
  set: value => emit('update:filter', value),
})

const viewModeValue = computed({
  get: () => props.viewMode,
  set: value => emit('update:viewMode', value),
})

const isSectionsOpen = shallowRef(false)
const sectionsButtonRef = useTemplateRef('sectionsButtonRef')
const sectionsMenuRef = useTemplateRef('sectionsMenuRef')
const sectionsMenuId = useId()

onClickOutside(
  sectionsMenuRef,
  () => {
    isSectionsOpen.value = false
  },
  { ignore: [sectionsButtonRef] },
)

onKeyDown(
  'Escape',
  () => {
    if (!isSectionsOpen.value) return
    isSectionsOpen.value = false
    sectionsButtonRef.value?.focus()
  },
  { dedupe: true },
)

const activeSectionsValue = computed({
  get: () =>
    props.activeSections ??
    (props.activeSection ? [props.activeSection] : (props.sections?.map(s => s.id) ?? [])),
  set: val => {
    emit('update:activeSections', val)
    if (val.length > 0) {
      emit('update:activeSection', val[0]!)
    }
  },
})

function getSectionLabel(id: string) {
  const labels: Record<string, string> = {
    dependencies: t('compare.dependencies'),
    devDependencies: t('compare.dev_dependencies'),
    peerDependencies: t('compare.peer_dependencies'),
    optionalDependencies: t('compare.optional_dependencies'),
    bundledDependencies: t('compare.bundled_dependencies'),
  }
  return labels[id] || id
}

function toggleSection(id: string) {
  const current = activeSectionsValue.value
  if (current.includes(id)) {
    activeSectionsValue.value = current.filter(s => s !== id)
  } else {
    activeSectionsValue.value = [...current, id]
  }
}

const sectionTriggerText = computed(() => {
  const total = props.sections?.length ?? 0
  const active = activeSectionsValue.value
  if (total === 1) {
    return getSectionLabel(props.sections![0]!.id)
  }
  if (total > 0 && active.length === total) {
    return t('package.dependencies.all')
  }
  if (active.length === 1) {
    return getSectionLabel(active[0]!)
  }
  return t('action_bar.selection', { count: active.length }, active.length)
})

const { selectedPackages, clearSelectedPackages, openSelectionView } = usePackageSelection()

// Parse current sort option into key and direction
const currentSortKey = computed(() => {
  if (props.sort.startsWith('name')) return 'name'
  if (props.sort.startsWith('updated')) return 'updated'
  return 'downloads-week'
})

const currentSortDirection = computed(() => (props.sort.endsWith('asc') ? 'asc' : 'desc'))

const sortKeyModel = computed({
  get: () => currentSortKey.value,
  set: (newKey: string) => {
    if (newKey === 'name') {
      emit('update:sort', 'name-asc')
    } else if (newKey === 'updated') {
      emit('update:sort', 'updated-desc')
    } else {
      emit('update:sort', 'downloads-week-desc')
    }
  },
})

function handleToggleDirection() {
  const key = currentSortKey.value
  const newDir = currentSortDirection.value === 'asc' ? 'desc' : 'asc'
  if (key === 'name') {
    emit('update:sort', newDir === 'asc' ? 'name-asc' : 'name-desc')
  } else if (key === 'updated') {
    emit('update:sort', newDir === 'asc' ? 'updated-asc' : 'updated-desc')
  } else {
    emit('update:sort', newDir === 'asc' ? 'downloads-week-asc' : 'downloads-week-desc')
  }
}

const sortOptions = computed(() => [
  { value: 'downloads-week' as const, label: t('filters.sort.downloads_week') },
  { value: 'updated' as const, label: t('filters.sort.published') },
  { value: 'name' as const, label: t('filters.sort.name') },
])

const showFilteredCount = computed(() => props.filter && props.filteredCount !== props.totalCount)
</script>

<template>
  <div class="flex flex-col gap-3 mb-4 border-b border-border pb-4">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <div v-if="sections && sections.length > 0" class="flex items-center gap-2">
        <div class="relative">
          <ButtonBase
            ref="sectionsButtonRef"
            :aria-expanded="isSectionsOpen"
            aria-haspopup="true"
            :aria-controls="isSectionsOpen ? sectionsMenuId : undefined"
            @click.stop="isSectionsOpen = !isSectionsOpen"
            classicon="i-lucide:layers"
          >
            {{ sectionTriggerText }}
          </ButtonBase>

          <Transition name="dropdown">
            <div
              v-if="isSectionsOpen"
              ref="sectionsMenuRef"
              :id="sectionsMenuId"
              class="absolute top-full inset-is-0 mt-2 w-64 bg-bg-subtle border border-border rounded-lg shadow-lg z-20"
              role="group"
              :aria-label="t('filters.title')"
            >
              <div class="py-1">
                <div
                  class="px-3 py-2 text-xs font-mono text-fg-subtle uppercase tracking-wider border-b border-border flex items-center justify-between"
                >
                  <span>{{ t('filters.title') }}</span>
                  <button
                    type="button"
                    class="text-xs text-fg-subtle hover:text-fg font-mono transition-colors cursor-pointer"
                    @click="
                      activeSectionsValue.length === sections.length
                        ? (activeSectionsValue = [])
                        : (activeSectionsValue = sections.map(s => s.id))
                    "
                  >
                    {{
                      activeSectionsValue.length === sections.length
                        ? t('filters.clear_all')
                        : t('filters.select_all')
                    }}
                  </button>
                </div>

                <div class="py-1 max-h-64 overflow-y-auto">
                  <label
                    v-for="section in sections"
                    :key="section.id"
                    class="flex gap-2 items-center px-3 py-2 transition-colors duration-200 hover:bg-bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="activeSectionsValue.includes(section.id)"
                      class="w-4 h-4 accent-fg bg-bg-muted border-border rounded"
                      @change="toggleSection(section.id)"
                    />
                    <span class="text-sm text-fg-muted font-mono flex-1 truncate">
                      {{ getSectionLabel(section.id) }}
                    </span>
                    <span class="text-xs text-fg-subtle font-mono">
                      ({{ section.items.length }})
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <span v-if="showFilteredCount" class="text-xs font-mono text-fg-muted">
          {{
            $t('package.list.showing_count', {
              filtered: filteredCount,
              total: totalCount,
            })
          }}
        </span>
      </div>
      <p v-else class="text-sm font-mono text-fg-muted shrink-0">
        <template v-if="showFilteredCount">
          {{
            $t('package.list.showing_count', {
              filtered: filteredCount,
              total: totalCount,
            })
          }}
        </template>
        <template v-else>
          {{ $t('package.dependencies.title', { count: $n(totalCount) }, totalCount) }}
        </template>
      </p>

      <div class="flex-1" />

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div class="flex-1 relative min-w-0">
          <label for="deps-filter" class="sr-only">{{ $t('package.list.filter_label') }}</label>
          <div
            class="absolute inset-is-0 h-full w-10 flex items-center justify-center text-fg-subtle pointer-events-none"
            aria-hidden="true"
          >
            <span class="i-lucide:search w-4 h-4" />
          </div>
          <InputBase
            id="deps-filter"
            v-model="filterValue"
            type="search"
            :placeholder="$t('package.dependencies.filter_placeholder')"
            no-correct
            class="w-full min-w-25 ps-10"
          />
        </div>

        <div class="flex items-center gap-3">
          <!-- Sort controls -->
          <div class="flex items-center gap-1 shrink-0">
            <SelectField
              :label="$t('package.list.sort_label')"
              hidden-label
              id="deps-sort"
              class="relative flex-1 sm:flex-initial sm:shrink-0 min-w-0"
              v-model="sortKeyModel"
              :items="sortOptions.map(o => ({ label: o.label, value: o.value }))"
            />

            <!-- Sort direction toggle -->
            <button
              type="button"
              class="p-2.5 rounded-md border border-border bg-bg-subtle text-fg-muted hover:text-fg hover:border-border-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              :aria-label="$t('filters.sort.toggle_direction')"
              :title="
                currentSortDirection === 'asc'
                  ? $t('filters.sort.ascending')
                  : $t('filters.sort.descending')
              "
              @click="handleToggleDirection"
            >
              <span
                class="w-4 h-4 block transition-transform duration-200"
                :class="
                  currentSortDirection === 'asc'
                    ? 'i-lucide:arrow-down-narrow-wide'
                    : 'i-lucide:arrow-down-wide-narrow'
                "
                aria-hidden="true"
              />
            </button>
          </div>

          <ColumnPicker
            v-if="viewModeValue === 'table' && columns"
            :columns="columns"
            @toggle="emit('toggleColumn', $event)"
            @reset="emit('resetColumns')"
          />

          <ViewModeToggle v-model="viewModeValue" class="shrink-0" />

          <div
            class="flex items-center order-3 sm:border-is sm:border-fg-subtle/20 sm:ps-3"
            v-if="selectedPackages.length"
          >
            <ButtonBase
              variant="secondary"
              @click="openSelectionView"
              classicon="i-lucide:package-check"
            >
              {{ t('filters.view_selected') }} ({{ selectedPackages.length }})
            </ButtonBase>
            <button
              @click="clearSelectedPackages"
              :aria-label="$t('filters.clear_selected_label')"
              class="flex items-center ms-2"
            >
              <span class="i-lucide:x text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
