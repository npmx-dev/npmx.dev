<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import type { BundleResult, DiscoveredSubpaths } from '~/bundler/types'
import type { BundlerWorker } from '~/bundler/worker-client'

type Result<T> = { ok: true; data: T } | { ok: false; error: Error }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const props = defineProps<{
  packageName: string
  subpaths: DiscoveredSubpaths
  worker: BundlerWorker
}>()

// Selected subpath
const selectedSubpath = ref<string | null>(props.subpaths.defaultSubpath)

// Initial bundle - fetches with null exports to discover all available exports
const initialBundleLoading = ref(false)
const initialBundleResult = computedAsync(
  async (): Promise<Result<BundleResult> | null> => {
    const subpath = selectedSubpath.value
    if (!subpath) return null
    try {
      const data = await props.worker.bundle(subpath, null)
      return { ok: true, data }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      }
    }
  },
  null,
  { lazy: false, evaluating: initialBundleLoading },
)

// Unwrap initial bundle result
const initialBundle = computed(() =>
  initialBundleResult.value?.ok ? initialBundleResult.value.data : null,
)
const initialBundleError = computed(() =>
  initialBundleResult.value?.ok === false ? initialBundleResult.value.error : null,
)

// Selected exports - null means "all"
const selectedExports = ref<string[] | null>(null)

// Reset selected exports when subpath changes
watch(selectedSubpath, () => {
  selectedExports.value = null
})

// Available exports from initial bundle (stable for each subpath)
const availableExports = computed(() => initialBundle.value?.exports ?? [])

// Bundle result - re-runs when selected exports change (only if not null)
const bundleLoading = ref(false)
const bundleResultQuery = computedAsync(
  async (): Promise<Result<BundleResult> | null> => {
    const subpath = selectedSubpath.value
    const exports = selectedExports.value
    // Only fetch if we have a subpath and exports is explicitly set (not null = all)
    if (!subpath || exports === null) return null
    try {
      const data = await props.worker.bundle(subpath, exports)
      return { ok: true, data }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      }
    }
  },
  null,
  { lazy: false, evaluating: bundleLoading },
)

// Unwrap bundle result
const bundleResult = computed(() =>
  bundleResultQuery.value?.ok ? bundleResultQuery.value.data : null,
)

// Use bundle result if available, otherwise fall back to initial bundle
const currentBundle = computed(() => bundleResult.value ?? initialBundle.value)

// Loading state
const isBundling = computed(() => initialBundleLoading.value || bundleLoading.value)

// Whether tree-shaking is available (not CJS)
const canTreeShake = computed(() => initialBundle.value && !initialBundle.value.isCjs)

// Toggle export selection
function toggleExport(exportName: string) {
  if (selectedExports.value === null) {
    // Currently "all" - switch to all except this one
    selectedExports.value = availableExports.value.filter(e => e !== exportName)
  } else if (selectedExports.value.includes(exportName)) {
    // Remove it
    selectedExports.value = selectedExports.value.filter(e => e !== exportName)
  } else {
    // Add it
    selectedExports.value = [...selectedExports.value, exportName]
  }
}

function selectAllExports() {
  selectedExports.value = null
}

function selectNoExports() {
  selectedExports.value = []
}

function isExportSelected(exportName: string): boolean {
  if (selectedExports.value === null) return true
  return selectedExports.value.includes(exportName)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="initialBundleLoading && !currentBundle" class="py-12 text-center">
      <div class="i-svg-spinners:ring-resize w-6 h-6 mx-auto text-fg-muted" />
      <p class="mt-3 text-fg-muted text-sm">
        {{ $t('impact.progress.bundle') }}
      </p>
    </div>

    <!-- Error state -->
    <div v-else-if="initialBundleError" class="py-12 text-center" role="alert">
      <div class="i-carbon:warning-alt w-6 h-6 mx-auto text-red-400 mb-3" />
      <p class="text-fg-muted text-sm">{{ initialBundleError.message }}</p>
    </div>

    <!-- Bundle Size Results -->
    <section v-else-if="currentBundle">
      <div class="flex items-center gap-2 mb-4">
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider">
          {{ $t('impact.bundle_size') }}
        </h2>
        <span
          v-if="isBundling && currentBundle"
          class="i-svg-spinners:ring-resize w-4 h-4 text-fg-subtle"
          aria-label="Rebundling"
        />
      </div>

      <!-- Subpath Selector -->
      <div v-if="subpaths.subpaths.length > 1" class="relative mb-4">
        <label class="sr-only">{{ $t('impact.subpath') }}</label>
        <select
          v-model="selectedSubpath"
          class="w-full px-3 py-1.5 pe-8 font-mono text-sm bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 appearance-none cursor-pointer"
        >
          <option v-for="sub in subpaths.subpaths" :key="sub.subpath" :value="sub.subpath">
            {{ sub.subpath === '.' ? packageName : `${packageName}${sub.subpath.slice(1)}` }}
          </option>
        </select>
        <span
          class="i-carbon-chevron-down absolute inset-ie-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
          aria-hidden="true"
        />
      </div>

      <!-- Size Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-bg-subtle border border-border rounded-lg p-4">
          <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
            {{ $t('impact.size.minified') }}
          </div>
          <div class="text-xl font-mono font-semibold text-fg">
            {{ formatBytes(currentBundle.size) }}
          </div>
        </div>
        <div class="bg-bg-subtle border border-border rounded-lg p-4">
          <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
            {{ $t('impact.size.gzip') }}
          </div>
          <div class="text-xl font-mono font-semibold text-fg">
            {{ formatBytes(currentBundle.gzipSize) }}
          </div>
        </div>
        <div
          v-if="currentBundle.brotliSize !== undefined"
          class="bg-bg-subtle border border-border rounded-lg p-4"
        >
          <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
            {{ $t('impact.size.brotli') }}
          </div>
          <div class="text-xl font-mono font-semibold text-fg">
            {{ formatBytes(currentBundle.brotliSize) }}
          </div>
        </div>
        <div
          v-if="currentBundle.zstdSize !== undefined"
          class="bg-bg-subtle border border-border rounded-lg p-4"
        >
          <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
            {{ $t('impact.size.zstd') }}
          </div>
          <div class="text-xl font-mono font-semibold text-fg">
            {{ formatBytes(currentBundle.zstdSize) }}
          </div>
        </div>
      </div>

      <!-- CJS Notice -->
      <div
        v-if="currentBundle.isCjs"
        class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6"
      >
        <p class="text-amber-400 text-sm">
          <span class="i-carbon:warning w-4 h-4 inline-block align-text-bottom me-1" />
          {{ $t('impact.exports_cjs_notice') }}
        </p>
      </div>

      <!-- Export Selection -->
      <div v-if="canTreeShake && availableExports.length > 0">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider">
            {{ $t('impact.exports') }}
          </h3>
          <div class="flex gap-2">
            <button
              type="button"
              class="text-xs text-fg-muted hover:text-fg transition-colors"
              @click="selectAllExports"
            >
              {{ $t('impact.select_all') }}
            </button>
            <span class="text-fg-subtle">|</span>
            <button
              type="button"
              class="text-xs text-fg-muted hover:text-fg transition-colors"
              @click="selectNoExports"
            >
              {{ $t('impact.select_none') }}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="exp in availableExports"
            :key="exp"
            type="button"
            class="px-3 py-1.5 font-mono text-sm rounded border transition-colors"
            :class="
              isExportSelected(exp)
                ? 'bg-accent/20 border-accent text-fg'
                : 'bg-bg-subtle border-border text-fg-muted hover:text-fg hover:border-border-hover'
            "
            @click="toggleExport(exp)"
          >
            {{ exp }}
          </button>
        </div>
      </div>
    </section>

    <!-- No subpaths -->
    <div v-else-if="!selectedSubpath" class="py-12 text-center text-fg-muted">
      <p>No bundleable entry points found</p>
    </div>
  </div>
</template>
