<script setup lang="ts">
const router = useRouter()
const canGoBack = useCanGoBack()
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
  ogTitle: () => `${$t('settings.title')} - npmx`,
  twitterTitle: () => `${$t('settings.title')} - npmx`,
  description: () => $t('settings.meta_description'),
  ogDescription: () => $t('settings.meta_description'),
  twitterDescription: () => $t('settings.meta_description'),
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
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded shrink-0 -mx-1.5 outline-transparent focus-visible:(outline-2 outline-accent outline-offset-2)"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
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
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.appearance') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-6">
            <!-- Theme selector -->
            <div class="space-y-2">
              <label for="theme-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.theme') }}
              </label>
              <SelectField
                id="theme-select"
                v-model="colorMode.preference"
                block
                size="sm"
                class="max-w-48"
                :items="[
                  { label: $t('settings.theme_system'), value: 'system' },
                  { label: $t('settings.theme_light'), value: 'light' },
                  { label: $t('settings.theme_dark'), value: 'dark' },
                ]"
              />
            </div>

            <!-- Accent colors -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.accent_colors') }}
              </span>
              <SettingsAccentColorPicker />
            </div>

            <!-- Background themes -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.background_themes') }}
              </span>
              <SettingsBgThemePicker />
            </div>
          </div>
        </section>

        <!-- DISPLAY Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.display') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
            <!-- Relative dates toggle -->
            <SettingsToggle
              :label="$t('settings.relative_dates')"
              v-model="settings.relativeDates"
            />

            <!-- Divider -->
            <div class="border-t border-border my-4" />

            <!-- Include @types in install toggle -->
            <SettingsToggle
              :label="$t('settings.include_types')"
              :description="$t('settings.include_types_description')"
              v-model="settings.includeTypesInInstall"
            />

            <!-- Divider -->
            <div class="border-t border-border my-4" />

            <!-- Hide platform-specific packages toggle -->
            <SettingsToggle
              :label="$t('settings.hide_platform_packages')"
              :description="$t('settings.hide_platform_packages_description')"
              v-model="settings.hidePlatformPackages"
            />
          </div>
        </section>

        <!-- DATA SOURCE Section -->
        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.search') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6">
            <div class="space-y-2">
              <label for="search-provider-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.data_source.label') }}
              </label>
              <p class="text-xs text-fg-muted mb-3">
                {{ $t('settings.data_source.description') }}
              </p>

              <ClientOnly>
                <SelectField
                  id="search-provider-select"
                  :items="[
                    { label: $t('settings.data_source.npm'), value: 'npm' },
                    { label: $t('settings.data_source.algolia'), value: 'algolia' },
                  ]"
                  v-model="settings.searchProvider"
                  block
                  size="sm"
                  class="max-w-48"
                />
                <template #fallback>
                  <SelectField
                    id="search-provider-select"
                    disabled
                    :items="[{ label: $t('common.loading'), value: 'loading' }]"
                    block
                    size="sm"
                    class="max-w-48"
                  />
                </template>
              </ClientOnly>

              <!-- Provider description -->
              <p class="text-xs text-fg-subtle mt-2">
                {{
                  settings.searchProvider === 'algolia'
                    ? $t('settings.data_source.algolia_description')
                    : $t('settings.data_source.npm_description')
                }}
              </p>

              <!-- Algolia attribution -->
              <a
                v-if="settings.searchProvider === 'algolia'"
                href="https://www.algolia.com/developers"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-xs text-fg-subtle hover:text-fg-muted transition-colors mt-2"
              >
                {{ $t('search.algolia_disclaimer') }}
                <span class="i-lucide:external-link w-3 h-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section>
          <h2 class="text-xs text-fg-muted uppercase tracking-wider mb-4">
            {{ $t('settings.sections.language') }}
          </h2>
          <div class="bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 space-y-4">
            <!-- Language selector -->
            <div class="space-y-2">
              <label for="language-select" class="block text-sm text-fg font-medium">
                {{ $t('settings.language') }}
              </label>

              <ClientOnly>
                <SelectField
                  id="language-select"
                  :items="locales.map(loc => ({ label: loc.name ?? '', value: loc.code }))"
                  v-model="locale"
                  @update:modelValue="setLocale($event as typeof locale)"
                  block
                  size="sm"
                  class="max-w-48"
                />
                <template #fallback>
                  <SelectField
                    id="language-select"
                    disabled
                    :items="[{ label: $t('common.loading'), value: 'loading' }]"
                    block
                    size="sm"
                    class="max-w-48"
                  />
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
              <LinkBase
                classicon="i-carbon:logo-github"
                class="font-sans"
                to="https://github.com/npmx-dev/npmx.dev/tree/main/i18n/locales"
              >
                <span class="i-simple-icons:github w-4 h-4" aria-hidden="true" />
                {{ $t('settings.help_translate') }}
              </LinkBase>
            </template>
          </div>
        </section>
      </div>
    </article>
  </main>
</template>
