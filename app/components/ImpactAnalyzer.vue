<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import type { InitResult, ProgressMessage } from '~/bundler/types'
import { BundlerWorker } from '~/bundler/worker-client'
import { progress } from '~/bundler/events'

const props = defineProps<{
  packageSpec: string
  packageName: string
}>()

const { t } = useI18n()

// Worker instance - created once
const worker = shallowRef<BundlerWorker | null>(null)

// Progress tracking
const progressState = ref<ProgressMessage | null>(null)
let progressListener: { off: () => void } | null = null

onMounted(() => {
  worker.value = new BundlerWorker()
  progressListener = progress.on(msg => {
    progressState.value = msg
  })
})

onUnmounted(() => {
  progressListener?.off()
  worker.value?.terminate()
})

type Result<T> = { ok: true; data: T } | { ok: false; error: Error }

// Initialize package (resolve deps, fetch tarballs)
const initLoading = ref(false)
const initResult = computedAsync(
  async (): Promise<Result<InitResult> | null> => {
    const w = worker.value
    if (!w) return null
    try {
      const data = await w.init(props.packageSpec)
      return { ok: true, data }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e : new Error(String(e)),
      }
    }
  },
  null,
  { lazy: false, evaluating: initLoading },
)

// Get progress message for display
const progressMessage = computed(() => {
  const prog = progressState.value
  if (!prog) return null

  switch (prog.kind) {
    case 'resolve':
      return t('impact.progress.resolve', {
        name: `${prog.name}@${prog.version}`,
      })
    case 'fetch':
      return t('impact.progress.fetch', {
        current: prog.current,
        total: prog.total,
      })
    case 'bundle':
      return t('impact.progress.bundle')
    case 'compress':
      return t('impact.progress.compress')
    default:
      return null
  }
})

// Unwrap result for easier template access
const init = computed(() => (initResult.value?.ok ? initResult.value.data : null))
const initError = computed(() => (initResult.value?.ok === false ? initResult.value.error : null))

// Check if package has bundleable subpaths
const hasSubpaths = computed(() => init.value?.subpaths?.defaultSubpath != null)
</script>

<template>
  <main class="container w-full flex-1 py-6">
    <!-- Loading/Progress state -->
    <div v-if="initLoading && !init" class="py-20 text-center">
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">
        {{ progressMessage || $t('impact.analyzing') }}
      </p>
    </div>

    <!-- Error state -->
    <div v-else-if="initError" class="py-20 text-center" role="alert">
      <div class="i-carbon:warning-alt w-8 h-8 mx-auto text-red-400 mb-4" />
      <p class="text-fg-muted mb-2">{{ $t('impact.error') }}</p>
      <p class="text-fg-subtle text-sm font-mono">{{ initError.message }}</p>
    </div>

    <!-- Results - Two column grid -->
    <div v-else-if="init && worker" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Left column: Bundle size -->
      <div>
        <ImpactBundle
          v-if="hasSubpaths"
          :package-name="packageName"
          :subpaths="init.subpaths"
          :worker="worker"
        />
        <div v-else class="py-12 text-center text-fg-muted">
          <p>No bundleable entry points found</p>
        </div>
      </div>

      <!-- Right column: Install size + Peer deps -->
      <div class="space-y-8">
        <ImpactInstall :packages="init.packages" :install-size="init.installSize" />

        <!-- Peer Dependencies -->
        <section v-if="init.peerDependencies.length > 0">
          <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('impact.peer_dependencies') }}
          </h2>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="peer in init.peerDependencies"
              :key="peer"
              class="px-2 py-1 font-mono text-xs bg-bg-subtle border border-border rounded"
            >
              {{ peer }}
            </span>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
