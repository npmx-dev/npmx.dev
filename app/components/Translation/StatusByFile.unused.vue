<script setup lang="ts">
/** This component is not used at the moment, but we keep it not to lose code
 *  produced to output report for translations per file. As we might need if
 *  we split single translation files into multiple as it grows significantly
 */
const { locale } = useI18n()
const { fetchStatus, localesMap } = useI18nStatus()

const localeEntries = computed(() => {
  const l = localesMap.value?.values()
  if (!l) return []
  return [...mapFiles(l)]
})

function* mapFiles(
  map: MapIterator<I18nLocaleStatus>,
): Generator<FileEntryStatus, undefined, void> {
  for (const entry of map) {
    yield {
      ...entry,
      lang: entry.lang,
      done: entry.completedKeys,
      missing: entry.missingKeys.length,
      file: entry.githubEditUrl.split('/').pop() ?? entry.lang,
    }
  }
}
</script>

<template>
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
        <template v-if="fetchStatus === 'error'">
          <tr>
            <td colspan="2" class="py-4 px-2 text-center text-red-500">
              {{ $t('translation_status.table.error') }}
            </td>
          </tr>
        </template>
        <template v-else-if="fetchStatus === 'pending' || fetchStatus === 'idle'">
          <tr>
            <td colspan="2" class="py-4 px-2 text-center text-fg-muted">
              <SkeletonBlock class="h-10 w-full mb-4" />
              <SkeletonBlock class="h-10 w-full mb-4" />
              <SkeletonBlock class="h-10 w-full mb-4" />
            </td>
          </tr>
        </template>
        <template v-else-if="!localeEntries || localeEntries.length === 0">
          <tr>
            <td colspan="2" class="py-4 px-2 text-center text-fg-muted">
              {{ $t('translation_status.table.empty') }}
            </td>
          </tr>
        </template>
        <template v-else>
          <tr>
            <td class="py-3 px-2 font-mono text-sm">
              <LinkBase to="https://github.com/npmx-dev/npmx.dev/blob/main/i18n/locales/en.json">
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
          <tr v-for="file in localeEntries" :key="file.lang">
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
                <ProgressBar
                  :val="file.percentComplete"
                  :label="$t('translation_status.progress_label', { locale: file.label })"
                />
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
</template>
