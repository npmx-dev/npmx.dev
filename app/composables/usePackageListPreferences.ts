/**
 * Manages view mode, columns, and pagination preferences for package lists
 */
import type {
  ColumnConfig,
  ColumnId,
  PackageListPreferences,
  PageSize,
  PaginationMode,
  ViewMode,
} from '#shared/types/preferences'
import { DEFAULT_COLUMNS, DEFAULT_PREFERENCES } from '#shared/types/preferences'

/**
 * Composable for managing package list display preferences
 * Persists to localStorage and provides reactive state
 *
 * @public
 */
export function usePackageListPreferences() {
  const {
    data: preferences,
    isHydrated,
    save,
    reset,
  } = usePreferencesProvider<PackageListPreferences>(DEFAULT_PREFERENCES)

  // Computed accessors for common properties
  const viewMode = computed({
    get: () => preferences.value.viewMode,
    set: (value: ViewMode) => {
      preferences.value.viewMode = value
      save()
    },
  })

  const paginationMode = computed({
    get: () => preferences.value.paginationMode,
    set: (value: PaginationMode) => {
      preferences.value.paginationMode = value
      save()
    },
  })

  const pageSize = computed({
    get: () => preferences.value.pageSize,
    set: (value: PageSize) => {
      preferences.value.pageSize = value
      save()
    },
  })

  const columns = computed({
    get: () => preferences.value.columns,
    set: (value: ColumnConfig[]) => {
      preferences.value.columns = value
      save()
    },
  })

  // Get visible columns only
  const visibleColumns = computed(() => columns.value.filter(col => col.visible))

  // Column visibility helpers
  function setColumnVisibility(columnId: ColumnId, visible: boolean) {
    const column = columns.value.find(col => col.id === columnId)
    if (column) {
      column.visible = visible
      save()
    }
  }

  function toggleColumn(columnId: ColumnId) {
    const column = columns.value.find(col => col.id === columnId)
    if (column) {
      column.visible = !column.visible
      save()
    }
  }

  function resetColumns() {
    preferences.value.columns = DEFAULT_COLUMNS.map(col => Object.assign({}, col))
    save()
  }

  // Check if column is visible
  function isColumnVisible(columnId: ColumnId) {
    return columns.value.find(col => col.id === columnId)?.visible ?? false
  }

  return {
    // Raw preferences
    preferences,
    isHydrated,

    // Individual properties with setters
    viewMode,
    paginationMode,
    pageSize,
    columns,
    visibleColumns,

    // Column helpers
    setColumnVisibility,
    toggleColumn,
    resetColumns,
    isColumnVisible,

    // Reset all
    reset,
  }
}
