<script setup lang="ts">
const { settings } = useSettings()
const { locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()

const availableLocales = computed(() =>
  locales.value.map(l => (typeof l === 'string' ? { code: l, name: l } : l)),
)

useSeoMeta({
  title: 'Settings - npmx',
})
</script>

<template>
  <main class="container py-8 sm:py-12 w-full">
    <div class="space-y-1 p-4 rounded-lg bg-bg-muted border border-border">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-bg-muted transition-[background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        role="menuitemcheckbox"
        :aria-checked="settings.relativeDates"
        @click="settings.relativeDates = !settings.relativeDates"
      >
        <span class="text-sm text-fg select-none">{{ $t('settings.relative_dates') }}</span>
        <span
          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-[background-color] duration-200 ease-in-out motion-reduce:transition-none shadow"
          :class="settings.relativeDates ? 'bg-fg' : 'bg-bg'"
          aria-hidden="true"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
            :class="
              settings.relativeDates ? 'translate-x-4 bg-bg-subtle' : 'translate-x-0 bg-fg-muted'
            "
          />
        </span>
      </button>

      <!-- Include @types in install toggle -->
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-bg-muted transition-[background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        role="menuitemcheckbox"
        :aria-checked="settings.includeTypesInInstall"
        @click="settings.includeTypesInInstall = !settings.includeTypesInInstall"
      >
        <span class="text-sm text-fg select-none text-left">{{
          $t('settings.include_types')
        }}</span>
        <span
          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-[background-color] duration-200 ease-in-out motion-reduce:transition-none border border-border shadow"
          :class="settings.includeTypesInInstall ? 'bg-fg' : 'bg-bg'"
          aria-hidden="true"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
            :class="
              settings.includeTypesInInstall
                ? 'translate-x-4 bg-bg-subtle'
                : 'translate-x-0 bg-fg-muted'
            "
          />
        </span>
      </button>

      <!-- Theme selector -->
      <div class="pt-2 mt-2 border-t border-border">
        <div class="px-2 py-1">
          <label for="theme-select" class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('settings.theme') }}
          </label>
        </div>
        <div class="px-2 py-1">
          <select
            id="theme-select"
            :value="colorMode.preference"
            class="w-full bg-bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-fg/50 cursor-pointer"
            @change="
              colorMode.preference = ($event.target as HTMLSelectElement).value as
                | 'light'
                | 'dark'
                | 'system'
            "
          >
            <option value="system">{{ $t('settings.theme_system') }}</option>
            <option value="light">{{ $t('settings.theme_light') }}</option>
            <option value="dark">{{ $t('settings.theme_dark') }}</option>
          </select>
        </div>
      </div>

      <!-- Language selector -->
      <div class="pt-2 mt-2 border-t border-border">
        <div class="px-2 py-1">
          <label for="language-select" class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('settings.language') }}
          </label>
        </div>
        <div class="px-2 py-1">
          <select
            id="language-select"
            :value="locale"
            class="w-full bg-bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-fg/50 cursor-pointer"
            @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
          >
            <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
              {{ loc.name }}
            </option>
          </select>
        </div>
        <a
          href="https://github.com/npmx-dev/npmx.dev/tree/main/i18n/locales"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 px-2 py-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
        >
          <span class="i-carbon-translate w-3.5 h-3.5" aria-hidden="true" />
          {{ $t('settings.help_translate') }}
        </a>
      </div>

      <div class="pt-2 mt-2 border-t border-border">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider px-2 py-1">
          {{ $t('settings.accent_colors') }}
        </h2>
        <div class="px-2 py-2">
          <AccentColorPicker />
        </div>
      </div>
    </div>
  </main>
</template>
