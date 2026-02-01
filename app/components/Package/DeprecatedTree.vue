<script setup lang="ts">
import type { DependencyDepth } from '#shared/types'

const props = defineProps<{
  packageName: string
  version: string
}>()

const { data: analysisData, status } = useDependencyAnalysis(
  () => props.packageName,
  () => props.version,
)

const isExpanded = shallowRef(false)
const showAll = shallowRef(false)

const hasDeprecated = computed(
  () => analysisData.value?.deprecatedPackages && analysisData.value.deprecatedPackages.length > 0,
)

// Banner color - purple for deprecated
const bannerColor = 'border-purple-600/40 bg-purple-500/10 text-purple-700 dark:text-purple-400'

// Styling for each depth level
const depthStyles = {
  root: {
    bg: 'bg-purple-500/5 border-is-2 border-is-purple-600',
    text: 'text-fg',
  },
  direct: {
    bg: 'bg-purple-500/5 border-is-2 border-is-purple-500',
    text: 'text-fg-muted',
  },
  transitive: {
    bg: 'bg-purple-500/5 border-is-2 border-is-purple-400',
    text: 'text-fg-muted',
  },
} as const

function getDepthStyle(depth: DependencyDepth) {
  return depthStyles[depth] || depthStyles.transitive
}
</script>

<template>
  <section v-if="status === 'success' && hasDeprecated" class="relative">
    <div class="rounded-lg border overflow-hidden" :class="bannerColor">
      <!-- Header -->
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-4 py-3 text-start transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg/50"
        :aria-expanded="isExpanded"
        aria-controls="deprecated-tree-details"
        @click="isExpanded = !isExpanded"
      >
        <div class="flex items-center gap-2 min-w-0">
          <span class="i-carbon-warning-hex w-4 h-4 shrink-0" aria-hidden="true" />
          <span class="font-mono text-sm font-medium truncate">
            {{ $t('package.deprecated.tree_found', analysisData!.deprecatedPackages.length) }}
          </span>
        </div>
        <span
          class="i-carbon-chevron-down w-4 h-4 transition-transform duration-200 shrink-0"
          :class="{ 'rotate-180': isExpanded }"
          aria-hidden="true"
        />
      </button>

      <!-- Expandable details -->
      <div
        v-show="isExpanded"
        id="deprecated-tree-details"
        class="border-t border-border bg-bg-subtle"
      >
        <ul class="divide-y divide-border list-none m-0 p-0">
          <li
            v-for="pkg in analysisData!.deprecatedPackages.slice(0, showAll ? undefined : 5)"
            :key="`${pkg.name}@${pkg.version}`"
            class="px-4 py-3"
            :class="getDepthStyle(pkg.depth).bg"
          >
            <div class="flex items-center gap-2 mb-1">
              <!-- Path badge -->
              <DependencyPathPopup v-if="pkg.path && pkg.path.length > 1" :path="pkg.path" />

              <NuxtLink
                :to="{
                  name: 'package',
                  params: { package: [...pkg.name.split('/'), 'v', pkg.version] },
                }"
                class="font-mono text-sm font-medium hover:underline truncate"
                :class="getDepthStyle(pkg.depth).text"
              >
                {{ pkg.name }}@{{ pkg.version }}
              </NuxtLink>
            </div>
            <p class="text-xs text-fg-muted m-0 line-clamp-2">
              {{ pkg.message }}
            </p>
          </li>
        </ul>

        <button
          v-if="analysisData!.deprecatedPackages.length > 5 && !showAll"
          type="button"
          class="w-full px-4 py-2 text-xs font-mono text-fg-muted hover:text-fg border-t border-border transition-colors duration-200"
          @click="showAll = true"
        >
          {{
            $t('package.deprecated.show_all', { count: analysisData!.deprecatedPackages.length })
          }}
        </button>
      </div>
    </div>
  </section>
</template>
