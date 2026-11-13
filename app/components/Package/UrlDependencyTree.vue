<script setup lang="ts">
const props = defineProps<{
  packageName: string
  version: string
}>()

const { data: analysisData, status } = useDependencyAnalysis(
  () => props.packageName,
  () => props.version,
)

const isExpanded = shallowRef(false)

const urlDependencies = computed(() => analysisData.value?.packagesWithUrlVersion ?? [])

const {
  visibleItems: visibleDependencies,
  hasMore: hasMoreDependencies,
  expand: expandDependencies,
} = useVisibleItems(() => urlDependencies.value, 5)

const bannerColor = 'border-orange-600/40 bg-orange-500/10 text-orange-700 dark:text-orange-400'

const depthStyles = {
  direct: 'bg-orange-500/5 border-is-2 border-is-orange-500',
  transitive: 'bg-orange-500/5 border-is-2 border-is-orange-400',
} as const
</script>

<template>
  <section v-if="status === 'success' && urlDependencies.length > 0" class="relative">
    <div class="rounded-lg border overflow-hidden" :class="bannerColor">
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-4 py-3 text-start transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
        :aria-expanded="isExpanded"
        aria-controls="url-dependency-tree-details"
        @click="isExpanded = !isExpanded"
      >
        <span class="flex items-center gap-2 min-w-0">
          <span class="i-lucide:git-branch w-4 h-4 shrink-0" aria-hidden="true" />
          <span class="font-mono text-sm font-medium truncate">
            {{ $t('package.url_dependency.tree_found', urlDependencies.length) }}
          </span>
        </span>
        <span
          class="i-lucide:chevron-down w-4 h-4 transition-transform duration-200 shrink-0"
          :class="{ 'rotate-180': isExpanded }"
          aria-hidden="true"
        />
      </button>

      <div
        v-show="isExpanded"
        id="url-dependency-tree-details"
        class="border-t border-border bg-bg-subtle"
      >
        <ul class="divide-y divide-border list-none m-0 p-0">
          <li
            v-for="dep in visibleDependencies"
            :key="`${dep.path.join('>')}>${dep.name}`"
            class="px-4 py-3"
            :class="depthStyles[dep.depth]"
          >
            <div class="flex items-center gap-2 mb-1">
              <DependencyPathPopup v-if="dep.path.length > 1" :path="dep.path" />
              <span class="font-mono text-sm font-medium text-fg truncate" dir="ltr">
                {{ dep.name }}
              </span>
            </div>
            <p class="font-mono text-xs text-fg-muted m-0 break-all" dir="ltr">
              {{ dep.spec }}
            </p>
          </li>
        </ul>

        <button
          v-if="hasMoreDependencies"
          type="button"
          class="w-full px-4 py-2 text-xs font-mono text-fg-muted hover:text-fg border-t border-border transition-colors duration-200"
          @click="expandDependencies"
        >
          {{ $t('package.url_dependency.show_all', { count: urlDependencies.length }) }}
        </button>
      </div>
    </div>
  </section>
</template>
