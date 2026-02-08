<script setup lang="ts">
import type { ColumnConfig, ColumnId } from '#shared/types/preferences'
import { onKeyDown } from '@vueuse/core'

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

onKeyDown(
  'Escape',
  e => {
    if (!isOpen.value) return
    isOpen.value = false
    buttonRef.value?.focus()
  },
  { dedupe: true },
)

// Columns that can be toggled (name is always visible)
const toggleableColumns = computed(() => props.columns.filter(col => col.id !== 'name'))

// Map column IDs to i18n keys
const columnLabels = computed(() => ({
  name: $t('filters.columns.name'),
  version: $t('filters.columns.version'),
  description: $t('filters.columns.description'),
  downloads: $t('filters.columns.downloads'),
  updated: $t('filters.columns.published'),
  maintainers: $t('filters.columns.maintainers'),
  keywords: $t('filters.columns.keywords'),
  qualityScore: $t('filters.columns.quality_score'),
  popularityScore: $t('filters.columns.popularity_score'),
  maintenanceScore: $t('filters.columns.maintenance_score'),
  combinedScore: $t('filters.columns.combined_score'),
  security: $t('filters.columns.security'),
}))

function getColumnLabel(id: ColumnId): string {
  const key = columnLabels.value[id]
  return key ?? id
}

function handleReset() {
  emit('reset')
  isOpen.value = false
}
</script>

<template>
  <div class="relative">
    <ButtonBase
      ref="buttonRef"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      :aria-controls="menuId"
      @click.stop="isOpen = !isOpen"
      classicon="i-carbon-column"
    >
      {{ $t('filters.columns.title') }}
    </ButtonBase>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="menuRef"
        :id="menuId"
        class="absolute top-full inset-ie-0 sm:inset-is-auto sm:inset-ie-0 mt-2 w-60 bg-bg-subtle border border-border rounded-lg shadow-lg z-20"
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
            <ButtonBase @click="handleReset">
              {{ $t('filters.columns.reset') }}
            </ButtonBase>
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
