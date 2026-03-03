<script setup lang="ts">
import { useSettings } from '~/composables/useSettings'

const { settings } = useSettings()

onPrehydrate(el => {
  const settingsSaved = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const enabled = settingsSaved.instantSearch
  if (enabled === false) {
    el.classList.add('hidden')
  }
})
</script>

<template>
  <p
    id="instant-search-advisory"
    class="text-fg-muted text-sm text-pretty"
    :class="settings.instantSearch ? '' : 'hidden'"
  >
    <span
      class="i-lucide:zap align-middle text-fg relative top-[-0.1em] me-1"
      style="font-size: 0.8em"
      aria-hidden="true"
    ></span>
    <i18n-t keypath="search.instant_search_advisory">
      <template #label>
        <strong>{{ $t('search.instant_search') }}</strong>
      </template>
      <template #settings>
        <LinkBase to="/settings">{{ $t('settings.title') }}</LinkBase>
      </template>
      <template #shortcut>
        <kbd class="text-xs"
          ><kbd class="text-fg bg-bg-muted border border-border px-1 py-[2px] rounded-sm">Ctrl</kbd
          >+<kbd class="text-fg bg-bg-muted border border-border px-1 py-[2px] rounded-sm"
            >/</kbd
          ></kbd
        >
      </template>
    </i18n-t>
  </p>
</template>
