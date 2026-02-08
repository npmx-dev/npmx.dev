<script setup lang="ts">
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const props = defineProps<{
  packageSpec: string
  packageName: string
}>()

const { t } = useI18n()
const { state, initPackage, bundle } = useBundleAnalyzer()

// Selected subpath
const selectedSubpath = ref<string | null>(null)

// Selected exports (null = all, [] = none)
const selectedExports = ref<string[] | null>(null)

// Start analysis on mount
onMounted(async () => {
  try {
    const result = await initPackage(props.packageSpec)

    // Set default subpath
    if (result.subpaths.defaultSubpath) {
      selectedSubpath.value = result.subpaths.defaultSubpath

      // Start initial bundle
      await bundle(result.subpaths.defaultSubpath, null)
    }
  } catch {
    // init failed — state.error will be set by useBundleAnalyzer
  }
})

// Re-bundle when subpath changes
let suppressExportWatch = false
watch(selectedSubpath, async newSubpath => {
  if (newSubpath && state.initResult) {
    suppressExportWatch = true
    selectedExports.value = null // Reset to all exports
    await bundle(newSubpath, null)
    suppressExportWatch = false
  }
})

// Re-bundle when selected exports change
watch(
  selectedExports,
  async newExports => {
    if (suppressExportWatch) return
    if (selectedSubpath.value && state.initResult && state.bundleResult) {
      await bundle(selectedSubpath.value, newExports)
    }
  },
  { deep: true },
)

// Get progress message for display
const progressMessage = computed(() => {
  const prog = state.progress
  if (!prog) return null

  switch (prog.kind) {
    case 'resolve':
      return t('impact.progress.resolve', { name: `${prog.name}@${prog.version}` })
    case 'fetch':
      return t('impact.progress.fetch', { current: prog.current, total: prog.total })
    case 'bundle':
      return t('impact.progress.bundle')
    case 'compress':
      return t('impact.progress.compress')
    default:
      return null
  }
})

// Available exports for selection
const availableExports = computed(() => {
  if (!state.bundleResult) return []
  return state.bundleResult.exports
})

// Whether tree-shaking is available (not CJS)
const canTreeShake = computed(() => {
  return state.bundleResult && !state.bundleResult.isCjs
})

// Toggle export selection
function toggleExport(exportName: string) {
  if (!selectedExports.value) {
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

// Select all exports
function selectAllExports() {
  selectedExports.value = null
}

// Select no exports
function selectNoExports() {
  selectedExports.value = []
}

// Check if an export is selected
function isExportSelected(exportName: string): boolean {
  if (selectedExports.value === null) return true
  return selectedExports.value.includes(exportName)
}
</script>

<template>
  <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6">
    <!-- Loading/Progress state -->
    <div
      v-if="state.status === 'initializing' || (state.status === 'bundling' && !state.bundleResult)"
      class="py-20 text-center"
    >
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ progressMessage || $t('impact.analyzing') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="state.status === 'error'" class="py-20 text-center" role="alert">
      <div class="i-carbon:warning-alt w-8 h-8 mx-auto text-red-400 mb-4" />
      <p class="text-fg-muted mb-2">{{ $t('impact.error') }}</p>
      <p class="text-fg-subtle text-sm font-mono">{{ state.error?.message }}</p>
    </div>

    <!-- Results -->
    <div v-else-if="state.initResult" class="space-y-8">
      <!-- Install Size Summary -->
      <section>
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-4">
          {{ $t('impact.install_size') }}
        </h2>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-mono font-semibold text-fg">
            {{ formatBytes(state.initResult.installSize) }}
          </span>
          <span class="text-fg-subtle">
            {{ $t('impact.total_unpacked', { count: state.initResult.packages.length }) }}
          </span>
        </div>
      </section>

      <!-- Subpath Selector -->
      <section v-if="state.initResult.subpaths.subpaths.length > 1">
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-3">
          {{ $t('impact.subpath') }}
        </h2>
        <div
          class="inline-flex items-center px-3 py-2 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/30)"
        >
          <select
            v-model="selectedSubpath"
            :aria-label="$t('impact.subpath')"
            class="bg-bg-subtle font-mono text-sm text-fg outline-none appearance-none cursor-pointer pe-6"
          >
            <option
              v-for="sub in state.initResult.subpaths.subpaths"
              :key="sub.subpath"
              :value="sub.subpath"
            >
              {{ sub.subpath === '.' ? packageName : `${packageName}${sub.subpath.slice(1)}` }}
            </option>
          </select>
          <span class="i-carbon:chevron-down w-4 h-4 text-fg-subtle -ms-5 pointer-events-none" />
        </div>
      </section>

      <!-- Bundle Size Results -->
      <section v-if="state.bundleResult">
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-4">
          {{ $t('impact.bundle_size') }}
        </h2>

        <!-- Size Stats Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div class="bg-bg-subtle border border-border rounded-lg p-4">
            <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
              {{ $t('impact.size.minified') }}
            </div>
            <div class="text-xl font-mono font-semibold text-fg">
              {{ formatBytes(state.bundleResult.size) }}
            </div>
          </div>
          <div class="bg-bg-subtle border border-border rounded-lg p-4">
            <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
              {{ $t('impact.size.gzip') }}
            </div>
            <div class="text-xl font-mono font-semibold text-fg">
              {{ formatBytes(state.bundleResult.gzipSize) }}
            </div>
          </div>
          <div
            v-if="state.bundleResult.brotliSize !== undefined"
            class="bg-bg-subtle border border-border rounded-lg p-4"
          >
            <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
              {{ $t('impact.size.brotli') }}
            </div>
            <div class="text-xl font-mono font-semibold text-fg">
              {{ formatBytes(state.bundleResult.brotliSize) }}
            </div>
          </div>
          <div
            v-if="state.bundleResult.zstdSize !== undefined"
            class="bg-bg-subtle border border-border rounded-lg p-4"
          >
            <div class="text-xs text-fg-subtle uppercase tracking-wider mb-1">
              {{ $t('impact.size.zstd') }}
            </div>
            <div class="text-xl font-mono font-semibold text-fg">
              {{ formatBytes(state.bundleResult.zstdSize) }}
            </div>
          </div>
        </div>

        <!-- CJS Notice -->
        <div
          v-if="state.bundleResult.isCjs"
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

        <!-- Rebundling indicator -->
        <div
          v-if="state.status === 'bundling'"
          class="flex items-center gap-2 mt-4 text-fg-subtle text-sm"
        >
          <span class="i-svg-spinners:ring-resize w-4 h-4" />
          {{ $t('impact.rebundling') }}
        </div>
      </section>

      <!-- Dependency Size Breakdown -->
      <section>
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-4">
          {{ $t('impact.dependencies') }}
        </h2>
        <ImpactDependencyBar :packages="state.initResult.packages" :package-name="packageName" />
      </section>

      <!-- Peer Dependencies Notice -->
      <section v-if="state.initResult.peerDependencies.length > 0">
        <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-3">
          {{ $t('impact.peer_dependencies') }}
        </h2>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="peer in state.initResult.peerDependencies"
            :key="peer"
            class="px-2 py-1 font-mono text-xs bg-bg-subtle border border-border rounded"
          >
            {{ peer }}
          </span>
        </div>
      </section>
    </div>
  </main>
</template>
