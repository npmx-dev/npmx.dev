<script setup lang="ts">
const router = useRouter()
const { settings } = useSettings()
const { locale, locales, setLocale } = useI18n()
const colorMode = useColorMode()
const { currentLocaleStatus, isSourceLocale } = useI18nStatus()

// Escape to go back (but not when focused on form elements)
onKeyStroke(
  'Escape',
  e => {
    const target = e.target as HTMLElement
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName)) {
      e.preventDefault()
      router.back()
    }
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
                <option value="system">{{ $t('settings.theme_system') }}</option>
                <option value="light">{{ $t('settings.theme_light') }}</option>
                <option value="dark">{{ $t('settings.theme_dark') }}</option>
              </select>
            </div>

            <!-- Accent colors -->
            <div class="space-y-3">
              <span class="block text-sm text-fg font-medium">
                {{ $t('settings.accent_colors') }}
              </span>
              <AccentColorPicker />
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
            <div class="space-y-2">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-4 group"
                role="switch"
                :aria-checked="settings.relativeDates"
                @click="settings.relativeDates = !settings.relativeDates"
              >
                <span class="text-sm text-fg font-medium text-start">
                  {{ $t('settings.relative_dates') }}
                </span>
                <span
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out motion-reduce:transition-none shadow-sm cursor-pointer"
                  :class="settings.relativeDates ? 'bg-accent' : 'bg-bg border border-border'"
                  aria-hidden="true"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
                    :class="settings.relativeDates ? 'bg-bg' : 'bg-fg-muted'"
                  />
                </span>
              </button>
              <p class="text-sm text-fg-muted">
                {{ $t('settings.relative_dates_description') }}
              </p>
            </div>

            <!-- Divider -->
            <div class="border-t border-border" />

            <!-- Include @types in install toggle -->
            <div class="space-y-2">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-4 group"
                role="switch"
                :aria-checked="settings.includeTypesInInstall"
                @click="settings.includeTypesInInstall = !settings.includeTypesInInstall"
              >
                <span class="text-sm text-fg font-medium text-start">
                  {{ $t('settings.include_types') }}
                </span>
                <span
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out motion-reduce:transition-none shadow-sm cursor-pointer"
                  :class="
                    settings.includeTypesInInstall ? 'bg-accent' : 'bg-bg border border-border'
                  "
                  aria-hidden="true"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
                    :class="settings.includeTypesInInstall ? 'bg-bg' : 'bg-fg-muted'"
                  />
                </span>
              </button>
              <p class="text-sm text-fg-muted">
                {{ $t('settings.include_types_description') }}
              </p>
            </div>

            <!-- Divider -->
            <div class="border-t border-border" />

            <!-- Hide platform-specific packages toggle -->
            <div class="space-y-2">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-4 group"
                role="switch"
                :aria-checked="settings.hidePlatformPackages"
                @click="settings.hidePlatformPackages = !settings.hidePlatformPackages"
              >
                <span class="text-sm text-fg font-medium text-start">
                  {{ $t('settings.hide_platform_packages') }}
                </span>
                <span
                  class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out motion-reduce:transition-none shadow-sm cursor-pointer"
                  :class="
                    settings.hidePlatformPackages ? 'bg-accent' : 'bg-bg border border-border'
                  "
                  aria-hidden="true"
                >
                  <span
                    class="pointer-events-none inline-block h-5 w-5 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
                    :class="settings.hidePlatformPackages ? 'bg-bg' : 'bg-fg-muted'"
                  />
                </span>
              </button>
              <p class="text-sm text-fg-muted">
                {{ $t('settings.hide_platform_packages_description') }}
              </p>
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
                <TranslationHelper :status="currentLocaleStatus" />
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

<style scoped>
button[aria-checked='false'] > span:last-of-type > span {
  translate: 0;
}
button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(100%);
}
html[dir='rtl'] button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(-100%);
}
</style>
