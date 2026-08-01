<script setup lang="ts">
import { useAnalyzeCauseWorker } from '~/composables/pkg-size/useAnalyzeCauseWorker'

const props = defineProps<{
  packageName?: string | null
  version?: string | null
  comparisonVersion?: string | null
  // don't use and don't remove open: used at a11y.spec.ts
  open?: boolean
}>()

const usePackage = computed(() => props.packageName)
const useVersion = computed(() => props.version)
const useComparedVersion = computed(() => props.comparisonVersion)

const {
  available,
  analyzing,
  cancelling,
  loading,
  result,
  error,
  summary,
  noResultScroll,
  allDependencies,
  startAnalyzeCause,
  cancelAnalyzeCause,
} = useAnalyzeCauseWorker(usePackage, useVersion, useComparedVersion)
</script>

<template>
  <div class="mt-3 flex flex-col">
    <div class="flex justify-start">
      <button
        type="button"
        :disabled="!available || cancelling"
        :aria-busy="loading || analyzing || cancelling"
        class="border border-amber-600/40 bg-amber-500/10 hover:bg-amber-500/20 rounded-md inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-300 px-3 py-1.5 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        @click="analyzing ? cancelAnalyzeCause() : startAnalyzeCause()"
      >
        <span class="inline-flex items-center gap-1.5">
          <span
            v-if="loading || analyzing || cancelling"
            class="i-lucide:loader-2 animate-spin w-3.5 h-3.5 shrink-0 transition-opacity duration-150"
            aria-hidden="true"
          />

          <span
            v-if="analyzing && !cancelling"
            class="i-lucide:square w-3 h-3 fill-current shrink-0"
            aria-hidden="true"
          />

          <span>
            {{
              cancelling
                ? $t('package.size_increase.analyze.cancelling')
                : analyzing
                  ? $t('package.size_increase.analyze.cancel')
                  : $t('package.size_increase.analyze.analyze')
            }}
          </span>
        </span>
      </button>
    </div>

    <Transition name="expand">
      <div v-if="summary || error" class="mt-3 border-t border-amber-600/20 pt-3 flex flex-col">
        <div
          v-if="error"
          role="alert"
          class="border border-rose-500/20 bg-rose-500/10 rounded-md px-3 py-2.5 flex items-start gap-2"
        >
          <span
            class="i-lucide:alert-circle w-4 h-4 shrink-0 text-rose-700 dark:text-rose-400 mt-0.5"
            aria-hidden="true"
          />
          <div class="flex flex-col gap-1">
            <span
              class="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-400"
            >
              {{ $t('package.size_increase.analyze.error') }}
            </span>
            <p class="text-xs text-rose-700 dark:text-rose-300 m-0 break-words">
              {{ error }}
            </p>
          </div>
        </div>
        <template v-else-if="summary">
          <!-- SUMMARY -->
          <div class="flex flex-col gap-1" aria-live="polite">
            <p class="text-xs text-amber-700 dark:text-amber-500 m-0">
              <span aria-hidden="true">📦</span>
              <i18n-t keypath="package.size_increase.analyze.summary.total_size" scope="global">
                <template #size>{{ summary.sizeDeltaText }}</template>
                <template #bytes>
                  <i18n-t keypath="package.size_increase.analyze.summary.bytes" scope="global">
                    <template #bytes>{{
                      summary.sizeDeltaBytesText || summary.sizeDelta
                    }}</template>
                  </i18n-t>
                </template>
              </i18n-t>
            </p>
            <p class="text-xs text-amber-700 dark:text-amber-500 m-0">
              <span aria-hidden="true">🧠</span>
              <i18n-t keypath="package.size_increase.analyze.summary.js_core_size" scope="global">
                <template #size>{{ summary.mandatorySizeDeltaText }}</template>
                <template #bytes>
                  <i18n-t keypath="package.size_increase.analyze.summary.bytes" scope="global">
                    <template #bytes>{{
                      summary.mandatorySizeDeltaBytesText || summary.mandatorySizeDelta
                    }}</template>
                  </i18n-t>
                </template>
              </i18n-t>
            </p>
            <p class="text-xs text-amber-700 dark:text-amber-500 m-0">
              <span aria-hidden="true">🧩</span>
              <i18n-t keypath="package.size_increase.analyze.summary.deps_variation" scope="global">
                <template #net>{{
                  summary.netDependenciesText ||
                  (summary.netDependencies > 0
                    ? `+${summary.netDependencies}`
                    : summary.netDependencies)
                }}</template>
                <template #details>
                  <i18n-t
                    keypath="package.size_increase.analyze.summary.deps_details"
                    scope="global"
                  >
                    <template #added>{{ summary.added }}</template>
                    <template #removed>{{ summary.removed }}</template>
                  </i18n-t>
                </template>
              </i18n-t>
            </p>
          </div>
          <!-- DIFF BALANCE -->
          <details class="group border-t border-amber-600/20 mt-3 pt-3 pb-1" :open>
            <summary
              class="flex items-center gap-2 cursor-pointer text-sm font-medium text-amber-900 dark:text-amber-400 select-none hover:text-amber-700 dark:hover:text-amber-200 rounded transition-colors duration-150"
            >
              <span
                class="i-lucide:chevron-right icon-rtl w-4 h-4 shrink-0 transition-transform duration-200 group-open:rotate-90 rtl:group-open:-rotate-90"
                aria-hidden="true"
              />
              {{ $t('package.size_increase.analyze.diff') }}
            </summary>

            <div class="mt-3">
              <div
                class="flex items-center justify-start gap-1.5 mb-2 pb-2 border-b border-amber-600/10"
                role="toolbar"
                :aria-label="$t('package.size_increase.analyze.title_controls')"
              >
                <button
                  type="button"
                  :aria-pressed="allDependencies"
                  @click="allDependencies = !allDependencies"
                  class="inline-flex items-center gap-1 text-xs uppercase font-bold tracking-wider text-amber-900 dark:text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-600/20 px-2 py-1 rounded transition-colors"
                >
                  <span
                    :class="allDependencies ? 'i-lucide:list-filter' : 'i-lucide:list-tree'"
                    class="w-3 h-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{{
                    allDependencies
                      ? $t('package.size_increase.analyze.only_deps')
                      : $t('package.size_increase.analyze.all_deps')
                  }}</span>
                </button>

                <button
                  type="button"
                  :aria-pressed="noResultScroll"
                  @click="noResultScroll = !noResultScroll"
                  class="inline-flex items-center gap-1 text-xs uppercase font-bold tracking-wider text-amber-900 dark:text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-600/20 px-2 py-1 rounded transition-colors"
                >
                  <span
                    :class="noResultScroll ? 'i-lucide:minimize-2' : 'i-lucide:maximize-2'"
                    class="w-3 h-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{{
                    noResultScroll
                      ? $t('package.size_increase.analyze.collapse')
                      : $t('package.size_increase.analyze.expand')
                  }}</span>
                </button>
              </div>

              <div
                class="custom-scrollbar pe-1 transition-all duration-300"
                :class="{ 'overflow-y-auto max-h-[216px]': !noResultScroll }"
                role="region"
                :aria-label="$t('package.size_increase.analyze.title_list')"
              >
                <ul
                  v-if="result && result.length > 0"
                  class="flex flex-col gap-1.5 m-0 p-0 list-none pe-1"
                >
                  <li
                    v-for="item in result"
                    :key="item.name"
                    class="flex flex-wrap items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-amber-500/5 hover:bg-amber-500/10 transition-colors border border-amber-600/10"
                  >
                    <div class="flex items-center gap-2.5">
                      <abbr
                        :title="item.statusText || item.status"
                        class="flex shrink-0 items-center justify-center w-6 h-6 rounded border no-underline cursor-help"
                        :class="{
                          'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20':
                            item.status === 'added',
                          'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20':
                            item.status === 'removed',
                          'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20':
                            item.status === 'changed',
                        }"
                      >
                        <span
                          v-if="item.status === 'added'"
                          class="i-lucide:plus w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span
                          v-else-if="item.status === 'removed'"
                          class="i-lucide:minus w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span
                          v-else-if="item.status === 'changed'"
                          class="i-lucide:arrow-left-right w-3.5 h-3.5 shrink-0"
                          aria-hidden="true"
                        />
                      </abbr>

                      <span
                        class="font-mono text-2xs font-semibold text-amber-900 dark:text-amber-300 break-all"
                      >
                        {{ item.name }}
                      </span>
                    </div>

                    <div class="flex items-center gap-1.5 ms-auto shrink-0">
                      <template v-if="item.status === 'changed' && item.v1 && item.v2">
                        <span
                          class="font-mono text-2xs line-through text-amber-700/80 dark:text-amber-500/80"
                        >
                          {{ item.v1.version }}
                        </span>
                        <span
                          class="i-lucide:arrow-right w-3.5 h-3.5 shrink-0 text-amber-700/60 rtl:rotate-180"
                          aria-hidden="true"
                        />
                        <span
                          class="font-mono text-2xs font-bold text-amber-900 dark:text-amber-300"
                        >
                          {{ item.v2.version }}
                        </span>
                      </template>
                      <template v-else>
                        <span
                          class="font-mono text-2xs font-medium text-amber-900 dark:text-amber-300"
                        >
                          {{ (item.v2 || item.v1)?.version }}
                        </span>
                      </template>

                      <span class="text-amber-600/40 mx-1 shrink-0" aria-hidden="true">|</span>

                      <span
                        class="font-mono text-2xs font-bold min-w-14 text-end shrink-0"
                        :class="{
                          'text-emerald-700 dark:text-emerald-400': item.status === 'removed',
                          'text-rose-700 dark:text-rose-400': item.status === 'added',
                          'text-amber-800 dark:text-amber-400': item.status === 'changed',
                        }"
                      >
                        {{ item.sizeDeltaText }}
                      </span>
                    </div>
                  </li>
                </ul>
                <div v-else class="text-xs text-amber-700/80 dark:text-amber-500/80 py-1">
                  {{ $t('package.size_increase.analyze.summary.no_deps') }}
                </div>
              </div>
            </div>
          </details>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition:
    max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.3s ease-in-out,
    margin-top 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    padding-top 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.4s ease-in-out;
  overflow: hidden;
  opacity: 1;
  /* Upper bound for the expand animation; content taller than this is clipped mid-transition. */
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0 !important;
  margin-top: 0 !important;
  border-color: transparent !important;
}

details[dir='rtl']:not([open]) .icon-rtl {
  transform: scale(-1, 1);
}
summary {
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}

.custom-scrollbar {
  scrollbar-width: auto;
  scrollbar-color: rgba(217, 119, 6, 0.3) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(217, 119, 6, 0.3);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(217, 119, 6, 0.5);
}

:global(.dark) .custom-scrollbar {
  scrollbar-color: rgba(251, 191, 36, 0.3) transparent;
}
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(251, 191, 36, 0.3);
}
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 191, 36, 0.5);
}
</style>
