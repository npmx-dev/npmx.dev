<script setup lang="ts">
import type { Directions } from '@nuxtjs/i18n'

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

const router = useRouter()
const canGoBack = useCanGoBack()
const { error, fetchStatus, localesMap, status } = useI18nStatus()
const { locale, locales, availableLocales } = useI18n()
const { copy, copied } = useClipboard()
const nuxt = useNuxtApp()

const localeMap = locales.value.reduce(
  (acc, l) => {
    acc[l.code] = l.dir ?? 'ltr'
    return acc
  },
  {} as Record<string, Directions>,
)

type LocaleKey = (typeof availableLocales)[number]

const generatedAt = computed(() => {
  const gat = status.value?.generatedAt
  if (import.meta.client) {
    return (nuxt.isHydrated ? new Date().toISOString() : gat) ?? new Date().toISOString()
  }

  return gat ?? new Date().toISOString()
})

interface FileStatus extends Omit<I18nLocaleStatus, 'lang'> {
  file: string
  lang: LocaleKey
}
interface FileEntryStatus extends FileStatus {
  done: number
  missing: number
  class?: string
  missingClass?: string
}

function* mapFiles(
  map: MapIterator<I18nLocaleStatus>,
): Generator<FileEntryStatus, undefined, void> {
  for (const entry of map) {
    yield {
      ...entry,
      lang: entry.lang as LocaleKey,
      done: entry.completedKeys,
      missing: entry.missingKeys.length,
      missingClass:
        entry.missingKeys.length > 0 ? 'text-orange-700 dark:text-orange-500' : undefined,
      file: entry.githubEditUrl.split('/').pop() ?? entry.lang,
    }
  }
}

const entries = computed(() => {
  const l = localesMap.value?.values()
  if (!l) return []
  return [...mapFiles(l)]
})

function copyMissingKeys(localeEntry: FileEntryStatus) {
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

      <p class="text-fg-muted leading-relaxed">
        <i18n-t keypath="translation_status.welcome" scope="global" tag="span">
          <template #npmx>
            <strong class="text-fg">npmx</strong>
          </template>
        </i18n-t>
      </p>

      <p class="text-fg-muted leading-relaxed pt-2">
        <i18n-t keypath="translation_status.p1" scope="global" tag="span">
          <template #lang>
            <strong>
              {{ $t('translation_status.p1_lang', {}, { locale }) }}
            </strong>
          </template>
          <template #count>
            <strong>
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
            <LinkBase to="#by-lang">
              {{ $t('translation_status.by_locale') }}
            </LinkBase>
          </template>
          <template #byfile>
            <LinkBase to="#by-file">
              {{ $t('translation_status.by_file') }}
            </LinkBase>
          </template>
        </i18n-t>
      </p>

      <p class="text-fg-muted leading-relaxed pt-2">
        <i18n-t keypath="translation_status.p2" scope="global" tag="span">
          <template #guide>
            <LinkBase
              to="https://github.com/npmx-dev/npmx.dev/blob/main/CONTRIBUTING.md#localization-i18n"
            >
              {{ $t('translation_status.guide') }}
            </LinkBase>
          </template>
        </i18n-t>
      </p>

      <section class="prose prose-invert max-w-none space-y-8 pt-8">
        <h2 id="by-lang" tabindex="-1" class="text-xs text-fg-muted uppercase tracking-wider mb-4">
          {{ $t('translation_status.by_locale') }}
        </h2>
        <template v-for="localeEntry in entries" :key="localeEntry.lang">
          <details
            class="group"
            :lang="localeEntry.lang"
            :dir="localeMap[localeEntry.lang] === 'rtl' ? 'rtl' : 'auto'"
          >
            <summary class="list-none cursor-pointer select-none">
              <span class="flex flex-col gap-2">
                <span class="flex items-center justify-between">
                  <span class="flex items-center gap-2">
                    <span
                      class="i-lucide:arrow-right icon-rtl w-4 h-4 transition-transform group-open:rotate-90 text-fg-muted"
                    ></span>
                    <i18n-t
                      keypath="translation_status.locale_summary"
                      scope="global"
                      tag="strong"
                      class="text-fg"
                      :locale="localeEntry.lang"
                    >
                      <template #id>
                        <span class="text-fg-muted font-normal">{{ localeEntry.lang }}</span>
                      </template>
                      <template #name>
                        {{ localeEntry.label }}
                      </template>
                    </i18n-t>
                  </span>
                  <span
                    class="font-mono text-sm"
                    :class="
                      localeEntry.missingKeys.length === 0
                        ? 'text-green-700 dark:text-green-500'
                        : 'text-orange-700 dark:text-orange-500'
                    "
                  >
                    {{ $n(localeEntry.percentComplete / 100, 'percentage', localeEntry.lang) }}
                  </span>
                </span>

                <span class="flex items-center gap-4 ps-6">
                  <progress
                    class="flex-1 h-2 rounded-full overflow-hidden"
                    max="100"
                    :value="localeEntry.percentComplete"
                    :class="{ done: localeEntry.done > 0 && localeEntry.missingKeys.length === 0 }"
                    :aria-label="
                      $t(
                        'translation_status.progress_label',
                        { locale: localeEntry.label },
                        { locale: localeEntry.lang },
                      )
                    "
                  ></progress>
                </span>

                <span class="ps-6 text-sm text-fg-muted flex gap-4">
                  <span class="inline-flex items-center gap-1">
                    <span
                      class="i-lucide:check w-3.5 h-3.5 text-green-700 dark:text-green-500"
                    ></span>
                    {{ localeEntry.done }}
                    {{ $t('translation_status.done_text', {}, { locale: localeEntry.lang }) }}
                  </span>
                  <span
                    v-if="localeEntry.missing > 0"
                    class="inline-flex items-center gap-1"
                    :class="localeEntry.missingClass"
                  >
                    <span class="i-lucide:list-x w-3.5 h-3.5"></span>
                    {{ localeEntry.missing }}
                    {{ $t('translation_status.missing_text', {}, { locale: localeEntry.lang }) }}
                  </span>
                </span>
              </span>
            </summary>

            <div class="ps-6 mt-4">
              <div
                v-if="localeEntry.missing > 0"
                class="p-4 rounded bg-bg-subtle border border-border"
              >
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-medium">
                    {{ $t('translation_status.missing_keys', {}, { locale: localeEntry.lang }) }}
                  </p>
                  <button
                    type="button"
                    class="text-xs text-accent hover:underline rounded focus-visible:outline-accent/70"
                    @click="copyMissingKeys(localeEntry)"
                  >
                    {{
                      copied
                        ? $t('common.copied', {}, { locale: localeEntry.lang })
                        : $t('i18n.copy_keys', {}, { locale: localeEntry.lang })
                    }}
                  </button>
                </div>
                <ul
                  class="space-y-1 text-xs font-mono bg-bg rounded-md p-2 max-h-64 overflow-y-auto"
                >
                  <li
                    v-for="key in localeEntry.missingKeys"
                    :key="key"
                    class="text-fg-muted truncate"
                    :title="key"
                  >
                    {{ key }}
                  </li>
                </ul>
                <div class="mt-4">
                  <a
                    :href="localeEntry.githubEditUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-bg hover:bg-bg-subtle border border-border rounded-md transition-colors focus-visible:outline-accent/70"
                  >
                    <span class="i-lucide:pen w-3.5 h-3.5" aria-hidden="true" />
                    {{ $t('i18n.edit_on_github', {}, { locale: localeEntry.lang }) }}
                  </a>
                </div>
              </div>
              <div
                v-else
                class="p-4 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-200 flex items-center gap-2"
              >
                <span class="i-lucide:check w-5 h-5"></span>
                <span>{{
                  $t('translation_status.complete_text', {}, { locale: localeEntry.lang })
                }}</span>
                <span aria-hidden="true">🎉</span>
              </div>
            </div>
          </details>
        </template>
      </section>

      <section class="prose prose-invert max-w-none space-y-8 pt-8">
        <h2 id="by-file" tabindex="-1" class="text-xs text-fg-muted uppercase tracking-wider mb-4">
          {{ $t('translation_status.by_file') }}
        </h2>
        <table class="w-full text-start border-collapse">
          <thead class="border-b border-border text-start">
            <tr>
              <th scope="col" class="py-2 px-2 font-medium text-fg-subtle text-sm">
                {{ $t('translation_status.table.file') }}
              </th>
              <th scope="col" class="py-2 px-2 font-medium text-fg-subtle text-sm">
                {{ $t('translation_status.table.status') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            <template v-if="error">
              <tr>
                <td colspan="2" class="py-4 px-2 text-center text-red-500">
                  {{ $t('translation_status.table.error') }}
                </td>
              </tr>
            </template>
            <template v-else-if="fetchStatus === 'pending'">
              <tr>
                <td colspan="2" class="py-4 px-2 text-center text-fg-muted">
                  {{ $t('translation_status.table.loading') }}
                </td>
              </tr>
            </template>
            <template v-else-if="!entries || entries.length === 0">
              <tr>
                <td colspan="2" class="py-4 px-2 text-center text-fg-muted">
                  {{ $t('translation_status.table.empty') }}
                </td>
              </tr>
            </template>
            <template v-else>
              <tr>
                <td class="py-3 px-2 font-mono text-sm">
                  <LinkBase
                    to="https://github.com/npmx-dev/npmx.dev/blob/main/i18n/locales/en.json"
                  >
                    <i18n-t
                      keypath="translation_status.table.file_link"
                      scope="global"
                      tag="span"
                      :class="locale === 'en-US' ? 'font-bold' : undefined"
                    >
                      <template #file>en.json</template>
                      <template #lang>en-US</template>
                    </i18n-t>
                  </LinkBase>
                </td>
                <td class="py-3 px-2">
                  <div class="flex items-center gap-2">
                    <progress
                      class="done w-24 h-1.5 rounded-full overflow-hidden"
                      max="100"
                      value="100"
                    ></progress>
                    <span class="text-xs font-mono text-fg-muted">
                      {{ $n(1, 'percentage') }}
                    </span>
                  </div>
                </td>
              </tr>
              <tr v-for="file in entries" :key="file.lang">
                <td class="py-3 px-2 font-mono text-sm">
                  <LinkBase :to="file.githubEditUrl">
                    <i18n-t
                      keypath="translation_status.table.file_link"
                      scope="global"
                      tag="span"
                      :class="locale === file.lang ? 'font-bold' : undefined"
                    >
                      <template #file>
                        {{ file.file }}
                      </template>
                      <template #lang>
                        {{ file.lang }}
                      </template>
                    </i18n-t>
                  </LinkBase>
                </td>
                <td class="py-3 px-2">
                  <div class="flex items-center gap-2">
                    <progress
                      class="w-24 h-1.5 rounded-full overflow-hidden"
                      max="100"
                      :value="file.percentComplete"
                      :class="{ done: file.done > 0 && file.missingKeys.length === 0 }"
                      :aria-label="$t('translation_status.progress_label', { locale: file.label })"
                    ></progress>
                    <span class="text-xs font-mono text-fg-muted">{{
                      $n(file.percentComplete / 100, 'percentage')
                    }}</span>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </article>
  </main>
</template>

<style scoped>
/* Reset & Base */
progress {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  @apply bg-bg-muted; /* Background for container */
}

/* Webkit Container */
progress::-webkit-progress-bar {
  @apply bg-bg-muted;
}

/* Value Bar */
progress::-webkit-progress-value {
  @apply bg-orange-700 dark:bg-orange-500 transition-all duration-300;
}
progress::-moz-progress-bar {
  @apply bg-orange-700 dark:bg-orange-500 transition-all duration-300;
}

/* Done State */
progress.done::-webkit-progress-value {
  @apply bg-green-700 dark:bg-green-500;
}
progress.done::-moz-progress-bar {
  @apply bg-green-700 dark:bg-green-500;
}

details[dir='rtl']:not([open]) .icon-rtl {
  transform: scale(-1, 1);
}
</style>
