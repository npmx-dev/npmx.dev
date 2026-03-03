<script setup lang="ts">
import { useSettings } from '~/composables/useSettings'

const { settings } = useSettings()

onPrehydrate(el => {
  const settingsSaved = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const enabled = settingsSaved.instantSearch
  if (enabled === false) {
    el.querySelector('[data-instant-search-on]')!.className = 'hidden'
    el.querySelector('[data-instant-search-off]')!.className = ''
  }
})
</script>

<template>
  <p id="instant-search-advisory" class="text-fg-muted text-sm text-pretty">
    <span
      class="i-lucide:zap align-middle text-fg relative top-[-0.1em] me-1"
      style="font-size: 0.8em"
      aria-hidden="true"
    />
    <span data-instant-search-on :class="settings.instantSearch ? '' : 'hidden'">
      <i18n-t keypath="search.instant_search_advisory">
        <template #label>
          {{ $t('search.instant_search') }}
        </template>
        <template #state>
          <strong>{{ $t('search.instant_search_on') }}</strong>
        </template>
        <template #action>
          <button type="button" class="underline" @click="settings.instantSearch = false">
            {{ $t('search.instant_search_turn_off') }}
          </button>
        </template>
      </i18n-t>
    </span>
    <span data-instant-search-off :class="settings.instantSearch ? 'hidden' : ''">
      <i18n-t keypath="search.instant_search_advisory">
        <template #label>
          {{ $t('search.instant_search') }}
        </template>
        <template #state>
          <strong>{{ $t('search.instant_search_off') }}</strong>
        </template>
        <template #action>
          <button type="button" class="underline" @click="settings.instantSearch = true">
            {{ $t('search.instant_search_turn_on') }}
          </button>
        </template>
      </i18n-t>
    </span>
  </p>
</template>
