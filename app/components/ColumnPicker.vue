<script setup lang="ts">
import type { ColumnConfig, ColumnId } from '#shared/types/preferences'

const props = defineProps<{
  columns: ColumnConfig[]
}>()

const emit = defineEmits<{
  toggle: [columnId: ColumnId]
  reset: []
}>()

const isOpen = shallowRef(false)
const buttonRef = useTemplateRef('buttonRef')
const menuRef = useTemplateRef('menuRef')
const menuId = useId()

// Close on click outside (check both button and menu)
onClickOutside(
  menuRef,
  () => {
    isOpen.value = false
  },
  {
    ignore: [buttonRef],
  },
)

// Close on Escape key
useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    buttonRef.value?.focus()
  }
})
// Columns that can be toggled (name is always visible)
const toggleableColumns = computed(() => props.columns.filter(col => col.id !== 'name'))

// Map column IDs to i18n keys
const columnLabelKey: Record<string, string> = {
  name: 'filters.columns.name',
  version: 'filters.columns.version',
  description: 'filters.columns.description',
  downloads: 'filters.columns.downloads',
  updated: 'filters.columns.updated',
  maintainers: 'filters.columns.maintainers',
  keywords: 'filters.columns.keywords',
  qualityScore: 'filters.columns.quality_score',
  popularityScore: 'filters.columns.popularity_score',
  maintenanceScore: 'filters.columns.maintenance_score',
  combinedScore: 'filters.columns.combined_score',
  security: 'filters.columns.security',
}

function getColumnLabel(id: string): string {
  const key = columnLabelKey[id]
  return key ? $t(key) : id
}

function handleReset() {
  emit('reset')
  isOpen.value = false
}
</script>

<template>
  <div class="relative">
    <button
      ref="buttonRef"
      type="button"
      class="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md hover:border-border-hover focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      :aria-controls="menuId"
      @click.stop="isOpen = !isOpen"
    >
      <span class="i-carbon-column w-4 h-4" aria-hidden="true" />
      <span class="font-mono text-sm">{{ $t('filters.columns.title') }}</span>
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="menuRef"
        :id="menuId"
        class="absolute inset-is-0 sm:inset-is-auto sm:inset-ie-0 mt-2 w-60 bg-bg-subtle border border-border rounded-lg shadow-lg z-20"
        role="group"
        :aria-label="$t('filters.columns.show')"
      >
        <div class="py-1">
          <div
            class="px-3 py-2 text-xs font-mono text-fg-subtle uppercase tracking-wider border-b border-border"
            aria-hidden="true"
          >
            {{ $t('filters.columns.show') }}
          </div>

          <div class="py-1 max-h-64 overflow-y-auto">
            <label
              v-for="column in toggleableColumns"
              :key="column.id"
              class="flex gap-2 items-center px-3 py-2 transition-colors duration-200"
              :class="
                column.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-bg-muted cursor-pointer'
              "
            >
              <input
                type="checkbox"
                :checked="column.visible"
                :disabled="column.disabled"
                :aria-describedby="column.disabled ? `${column.id}-disabled-reason` : undefined"
                class="w-4 h-4 accent-fg bg-bg-muted border-border rounded disabled:opacity-50"
                @change="!column.disabled && emit('toggle', column.id)"
              />
              <span class="text-sm text-fg-muted font-mono flex-1">
                {{ getColumnLabel(column.id) }}
              </span>
              <TooltipApp
                v-if="column.disabled"
                :id="`${column.id}-disabled-reason`"
                class="text-fg-subtle"
                :text="$t('filters.columns.coming_soon')"
                position="left"
              >
                <span class="size-4 flex justify-center items-center text-xs border rounded-full"
                  >i</span
                >
              </TooltipApp>
            </label>
          </div>

          <div class="border-t border-border py-1">
            <button
              type="button"
              class="w-full px-3 py-2 text-start text-sm font-mono text-fg-muted hover:bg-bg-muted hover:text-fg transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset"
              @click="handleReset"
            >
              {{ $t('filters.columns.reset') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
