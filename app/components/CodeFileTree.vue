<script setup lang="ts">
import type { PackageFileTree } from '#shared/types'
import { getFileIcon } from '~/utils/file-icons'

const props = defineProps<{
  tree: PackageFileTree[]
  currentPath: string
  baseUrl: string
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)

// Check if a node or any of its children is currently selected
function isNodeActive(node: PackageFileTree): boolean {
  if (props.currentPath === node.path) return true
  if (props.currentPath.startsWith(node.path + '/')) return true
  return false
}

// State for expanded directories
const expandedDirs = ref<Set<string>>(new Set())

// Auto-expand directories in the current path
watch(() => props.currentPath, (path) => {
  if (!path) return
  const parts = path.split('/')
  for (let i = 1; i <= parts.length; i++) {
    expandedDirs.value.add(parts.slice(0, i).join('/'))
  }
}, { immediate: true })

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path)
  }
  else {
    expandedDirs.value.add(path)
  }
}

function isExpanded(path: string): boolean {
  return expandedDirs.value.has(path)
}
</script>

<template>
  <ul
    class="list-none m-0 p-0"
    :class="depth === 0 ? 'py-2' : ''"
  >
    <li
      v-for="node in tree"
      :key="node.path"
    >
      <!-- Directory -->
      <template v-if="node.type === 'directory'">
        <button
          class="w-full flex items-center gap-1.5 py-1.5 px-3 text-left font-mono text-sm transition-colors hover:bg-bg-muted"
          :class="isNodeActive(node) ? 'text-fg' : 'text-fg-muted'"
          :style="{ paddingLeft: `${depth * 12 + 12}px` }"
          @click="toggleDir(node.path)"
        >
          <span
            class="w-4 h-4 shrink-0 transition-transform"
            :class="[
              isExpanded(node.path) ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right',
            ]"
          />
          <span
            class="w-4 h-4 shrink-0"
            :class="isExpanded(node.path) ? 'i-carbon-folder-open text-yellow-500' : 'i-carbon-folder text-yellow-600'"
          />
          <span class="truncate">{{ node.name }}</span>
        </button>
        <CodeFileTree
          v-if="isExpanded(node.path) && node.children"
          :tree="node.children"
          :current-path="currentPath"
          :base-url="baseUrl"
          :depth="depth + 1"
        />
      </template>

      <!-- File -->
      <template v-else>
        <NuxtLink
          :to="`${baseUrl}/${node.path}`"
          class="flex items-center gap-1.5 py-1.5 px-3 font-mono text-sm transition-colors hover:bg-bg-muted"
          :class="currentPath === node.path ? 'bg-bg-muted text-fg' : 'text-fg-muted'"
          :style="{ paddingLeft: `${depth * 12 + 32}px` }"
        >
          <span
            class="w-4 h-4 shrink-0"
            :class="getFileIcon(node.name)"
          />
          <span class="truncate">{{ node.name }}</span>
        </NuxtLink>
      </template>
    </li>
  </ul>
</template>
