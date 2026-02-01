<script setup lang="ts">
const router = useRouter()
const { settings } = useSettings()
const { locale, locales, setLocale: setNuxti18nLocale } = useI18n()
const colorMode = useColorMode()
const { currentLocaleStatus, isSourceLocale } = useI18nStatus()

// Escape to go back (but not when focused on form elements or modal is open)
onKeyStroke(
  e =>
    isKeyWithoutModifiers(e, 'Escape') &&
    !isEditableElement(e.target) &&
    !document.documentElement.matches('html:has(:modal)'),
  e => {
    e.preventDefault()
    router.back()
  },
  { dedupe: true },
)

useSeoMeta({
  title: () => `${$t('settings.title')} - npmx`,
  description: () => $t('settings.meta_description'),
})

defineOgImageComponent('Default', {
  title: () => $t('settings.title'),
  description: () => $t('settings.tagline'),
  primaryColor: '#60a5fa',
})

const setLocale: typeof setNuxti18nLocale = locale => {
  settings.value.selectedLocale = locale
  return setNuxti18nLocale(locale)
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 w-full">
    <article class="max-w-2xl mx-auto">
      <!-- Header -->
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('settings.title') }}
          </h1>
          <button
            type="button"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 shrink-0"
            @click="router.back()"
          >
            <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('settings.tagline') }}
        </p>
      </header>

      <!-- Settings sections -->
      <div class="space-y-8">
        <!-- APPEARANCE Section -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('settings.sections.appearance') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-6">
            <!-- Theme selector -->
            <div class="space-y-2">
              <label for="theme-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.theme') }}
              </label>
              <select
                id="theme-select"
                :value="colorMode.preference"
                class="w-full sm:w-auto min-w-48 bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 cursor-pointer"
                @change="
                  colorMode.preference = ($event.target as HTMLSelectElement).value as
                    | 'light'
                    | 'dark'
                    | 'system'
                "
              >
                <option value="system">
                  {{ $t('settings.theme_system') }}
                </option>
                <option value="light">{{ $t('settings.theme_light') }}</option>
                <option value="dark">{{ $t('settings.theme_dark') }}</option>
              </select>
            </div>

            <!-- Accent colors -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.accent_colors') }}
              </span>
              <SettingsAccentColorPicker />
            </div>
          </div>
        </section>

        <!-- DISPLAY Section -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('settings.sections.display') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-4">
            <!-- Relative dates toggle -->
            <SettingsToggle
              :label="$t('settings.relative_dates')"
              v-model="settings.relativeDates"
            />

            <!-- Divider -->
            <div class="border-t border-border" />

            <!-- Include @types in install toggle -->
            <div class="space-y-2">
              <SettingsToggle
                :label="$t('settings.include_types')"
                :description="$t('settings.include_types_description')"
                v-model="settings.includeTypesInInstall"
              />
            </div>

            <!-- Divider -->
            <div class="border-t border-border" />

            <!-- Hide platform-specific packages toggle -->
            <div class="space-y-2">
              <SettingsToggle
                :label="$t('settings.hide_platform_packages')"
                :description="$t('settings.hide_platform_packages')"
                v-model="settings.hidePlatformPackages"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('settings.sections.language') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-4">
            <!-- Language selector -->
            <div class="space-y-2">
              <label for="language-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.language') }}
              </label>

              <ClientOnly>
                <select
                  id="language-select"
                  :value="locale"
                  class="w-full sm:w-auto min-w-48 bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 cursor-pointer"
                  @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
                >
                  <option v-for="loc in locales" :key="loc.code" :value="loc.code" :lang="loc.code">
                    {{ loc.name }}
                  </option>
                </select>
                <template #fallback>
                  <select
                    id="language-select"
                    disabled
                    class="w-full sm:w-auto min-w-48 bg-bg border border-border rounded-md px-3 py-2 text-sm text-fg opacity-50 cursor-wait"
                  >
                    <option>{{ $t('common.loading') }}</option>
                  </select>
                </template>
              </ClientOnly>
            </div>

            <!-- Translation helper for non-source locales -->
            <template v-if="currentLocaleStatus && !isSourceLocale">
              <div class="border-t border-border pt-4">
                <SettingsTranslationHelper :status="currentLocaleStatus" />
              </div>
            </template>

            <!-- Simple help link for source locale -->
            <template v-else>
              <a
                href="https://github.com/npmx-dev/npmx.dev/tree/main/i18n/locales"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
              >
                <span class="i-carbon:logo-github w-4 h-4" aria-hidden="true" />
                {{ $t('settings.help_translate') }}
              </a>
            </template>
          </div>
        </section>
      </div>
    </article>
  </main>
</template>
