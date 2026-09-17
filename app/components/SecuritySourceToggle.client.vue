<script setup lang="ts">
import type { SecuritySourceId } from '#shared/types/dependency-analysis'

const props = withDefaults(
  defineProps<{
    /** Smaller trigger button, for dense contexts like the stats banner */
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const { t } = useI18n()
const { enabledSources, sourceAvailability, anySourceEnabled, setSourceEnabled } =
  useSecuritySources()

const isOpen = shallowRef(false)
const toggleRef = useTemplateRef('toggleRef')

onClickOutside(toggleRef, () => {
  isOpen.value = false
})

useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
})

const sourceLabels = computed<Record<SecuritySourceId, { label: string; description: string }>>(
  () => ({
    osv: {
      label: t('settings.security_sources.osv'),
      description: t('settings.security_sources.osv_description'),
    },
    socket: {
      label: t('settings.security_sources.socket'),
      description: t('settings.security_sources.socket_description'),
    },
  }),
)

const sources = computed(() =>
  SECURITY_SOURCE_IDS.map(id => ({
    id,
    label: sourceLabels.value[id].label,
    description: sourceLabels.value[id].description,
    enabled: enabledSources.value[id],
    available: sourceAvailability.value[id],
  })),
)
</script>

<template>
  <div ref="toggleRef" class="relative">
    <ButtonBase
      :aria-label="$t('settings.security_sources.label')"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      size="sm"
      class="border-none justify-center !px-0"
      :class="props.compact ? 'w-6 h-6' : 'w-8 h-8'"
      classicon="i-lucide:shield"
      @click="isOpen = !isOpen"
    />

    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute inset-ie-0 top-full pt-2 w-72 z-50 normal-case tracking-normal"
        role="menu"
        :aria-label="$t('settings.security_sources.label')"
      >
        <div
          class="bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-bg-elevated/50 overflow-hidden p-1"
        >
          <button
            v-for="source in sources"
            :key="source.id"
            type="button"
            role="menuitemcheckbox"
            :aria-checked="source.enabled && source.available"
            :disabled="!source.available"
            class="w-full flex items-start gap-3 px-3 py-2.5 rounded-md text-start transition-colors"
            :class="[
              source.available
                ? 'cursor-pointer hover:bg-bg-muted'
                : 'cursor-not-allowed opacity-60',
              source.enabled && source.available ? 'bg-bg-muted' : '',
            ]"
            @click="setSourceEnabled(source.id, !source.enabled)"
          >
            <span
              class="w-4 h-4 mt-0.5 shrink-0"
              :class="[
                source.enabled && source.available
                  ? 'i-lucide:square-check text-accent'
                  : 'i-lucide:square text-fg-muted',
              ]"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <div
                class="text-sm font-medium"
                :class="source.enabled && source.available ? 'text-fg' : 'text-fg-muted'"
              >
                {{ source.label }}
              </div>
              <p class="text-xs text-fg-subtle mt-0.5">
                {{ source.description }}
              </p>
              <p v-if="!source.available" class="text-xs text-fg-subtle mt-0.5 italic">
                {{ $t('settings.security_sources.unavailable_on_deployment') }}
              </p>
            </div>
          </button>

          <!-- Warning when every source is disabled -->
          <div
            v-if="!anySourceEnabled"
            class="border-t border-border mx-1 mt-1 pt-2 pb-1 px-2 flex items-start gap-2 text-xs text-red-700 dark:text-red-400"
          >
            <span class="i-lucide:triangle-alert w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{{ $t('security_sources.none_enabled') }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
