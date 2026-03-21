<script setup lang="ts">
definePageMeta({
  name: 'translation-status',
})

useSeoMeta({
  title: () => `${$t('translation_status.title')} - npmx`,
  description: () => $t('translation_status.welcome', { npmx: 'npmx' }),
})

defineOgImageComponent('Default', {
  title: () => $t('translation_status.title'),
  description: () => $t('translation_status.welcome', { npmx: 'npmx' }),
})

const nuxt = useNuxtApp()
const router = useRouter()
const canGoBack = useCanGoBack()
const { fetchStatus, status } = useI18nStatus()
const { locale } = useI18n()
const { copy, copied } = useClipboard()

const isLoading = computed<boolean>(
  () => fetchStatus.value === 'idle' || fetchStatus.value === 'pending',
)

const generatedAt = computed(() => {
  const gat = status.value?.generatedAt
  if (import.meta.client) {
    return (nuxt.isHydrated ? new Date().toISOString() : gat) ?? new Date().toISOString()
  }

  return gat ?? new Date().toISOString()
})

const localeEntries = computed<I18nLocaleStatus[]>(() => status.value?.locales || [])

function copyMissingKeys(localeEntry: I18nLocaleStatus) {
  const template = localeEntry.missingKeys.map(key => `  "${key}": ""`).join(',\n')
  const fullTemplate = `// Missing translations for ${localeEntry.label} (${localeEntry.lang})
// Add these keys to: i18n/locales/${localeEntry.lang}.json

${template}`

  copy(fullTemplate)
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('translation_status.title') }}
          </h1>
          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left icon-rtl w-4 h-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <i18n-t
          keypath="translation_status.generated_at"
          tag="p"
          scope="global"
          class="text-fg-muted text-lg"
        >
          <template #date>
            <NuxtTime :locale :datetime="generatedAt" date-style="long" time-style="medium" />
          </template>
        </i18n-t>
      </header>

      <p class="text-fg-muted leading-relaxed mb-4">
        <i18n-t keypath="translation_status.welcome" scope="global" tag="span">
          <template #npmx>
            <strong class="text-fg">npmx</strong>
          </template>
        </i18n-t>
      </p>

      <p class="text-fg-muted leading-relaxed mb-4">
        <i18n-t keypath="translation_status.p1" scope="global" tag="span">
          <template #lang>
            <strong class="text-fg">
              {{ $t('translation_status.p1_lang', {}, { locale }) }}
            </strong>
          </template>
          <template #count>
            <SkeletonInline v-if="isLoading" class="h-4 w-20 mx-1" />
            <strong v-else class="text-fg">
              {{
                $t(
                  'translation_status.p1_count',
                  { count: status?.sourceLocale.totalKeys ?? 0 },
                  { locale },
                )
              }}
            </strong>
          </template>
          <template #bylang>
            <LinkBase to="#by-lang" class="font-sans">
              {{ $t('translation_status.by_locale') }}
            </LinkBase>
          </template>
        </i18n-t>
      </p>

      <p class="text-fg-muted leading-relaxed mb-4">
        <i18n-t keypath="translation_status.p2" scope="global" tag="span">
          <template #guide>
            <LinkBase
              to="https://github.com/npmx-dev/npmx.dev/blob/main/CONTRIBUTING.md#localization-i18n"
              class="font-sans"
            >
              {{ $t('translation_status.guide') }}
            </LinkBase>
          </template>
        </i18n-t>
      </p>

      <section class="prose prose-invert max-w-none space-y-8 pt-4">
        <h2 id="by-lang" tabindex="-1" class="text-xs text-fg-muted uppercase tracking-wider mb-4">
          {{ $t('translation_status.by_locale') }}
        </h2>
        <div v-if="fetchStatus !== 'success'" class="space-y-2">
          <SkeletonBlock class="h-20 w-full mb-4" />
          <SkeletonBlock class="h-20 w-full mb-4" />
          <SkeletonBlock class="h-20 w-full mb-4" />
        </div>
        <template v-else-if="fetchStatus === 'success'">
          <details
            v-for="localeEntry in localeEntries"
            :key="localeEntry.lang"
            class="group rounded bg-bg-subtle border border-border p-4 mb-4"
            :lang="localeEntry.lang"
            :dir="localeEntry.dir === 'rtl' ? 'rtl' : 'auto'"
          >
            <summary class="max-w-full list-none cursor-pointer select-none">
              <span class="flex flex-col gap-2">
                <span class="flex items-center justify-between">
                  <span class="flex items-center gap-2">
                    <span
                      class="i-lucide:arrow-right icon-rtl w-4 h-4 transition-transform group-open:rotate-90 text-fg-muted"
                    ></span>
                    <span class="text-fg">{{ localeEntry.label }}</span>
                    <span class="text-fg-muted font-normal ps-2">{{ localeEntry.lang }}</span>
                  </span>
                  <span class="font-mono text-sm text-fg-muted">
                    {{ $n(localeEntry.percentComplete / 100, 'percentage') }}
                  </span>
                </span>

                <span class="flex items-center gap-4 ps-6">
                  <ProgressBar
                    :val="localeEntry.percentComplete"
                    :label="$t('translation_status.progress_label', { locale: localeEntry.label })"
                  />
                </span>

                <span class="ps-6 text-sm text-fg-muted flex justify-between gap-4">
                  <template v-if="localeEntry.missingKeys.length > 0">
                    <span class="inline-flex items-center text-amber-800 dark:text-amber-400 gap-1">
                      <span class="i-lucide:list-x w-3.5 h-3.5"></span>
                      {{ localeEntry.missingKeys.length }}
                      {{ $t('translation_status.missing_text', {}, { locale: localeEntry.lang }) }}
                    </span>
                    <span>{{ localeEntry.completedKeys }} / {{ localeEntry.totalKeys }}</span>
                  </template>
                  <span
                    v-else
                    class="i-lucide:check w-3.5 h-3.5 text-green-700 dark:text-green-500"
                  />
                </span>
              </span>
            </summary>

            <div class="ps-6 max-md:ps-3 mt-6">
              <template v-if="localeEntry.missingKeys.length > 0">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-sm font-medium text-fg my-0">
                    {{ $t('translation_status.missing_keys', {}, { locale: localeEntry.lang }) }}
                  </h4>
                  <ButtonBase type="button" size="small" @click="copyMissingKeys(localeEntry)">
                    {{
                      copied
                        ? $t('common.copied', {}, { locale: localeEntry.lang })
                        : $t('i18n.copy_keys', {}, { locale: localeEntry.lang })
                    }}
                  </ButtonBase>
                </div>
                <div class="max-w-full">
                  <ul
                    class="text-xs font-mono bg-bg rounded-md max-h-64 overflow-y-auto overflow-x-auto space-y-1 p-2 mt-0"
                  >
                    <li
                      v-for="key in localeEntry.missingKeys"
                      :key="key"
                      class="text-fg-muted break-all whitespace-normal border-b border-border/10 last:border-0 pb-1"
                      :title="key"
                    >
                      {{ key }}
                    </li>
                  </ul>
                </div>
                <div class="mt-4">
                  <LinkBase
                    :to="localeEntry.githubEditUrl"
                    variant="button-secondary"
                    size="medium"
                  >
                    {{ $t('i18n.edit_on_github', {}, { locale: localeEntry.lang }) }}
                  </LinkBase>
                </div>
              </template>
              <div
                v-else
                class="p-4 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-200 flex items-start gap-2"
              >
                <span>{{
                  $t('translation_status.complete_text', {}, { locale: localeEntry.lang })
                }}</span>
                <span aria-hidden="true">🎉</span>
              </div>
            </div>
          </details>
        </template>
      </section>
    </article>
  </main>
</template>
