<script setup lang="ts">
import type { PackageFileTree } from '#shared/types'
import type { RouteLocationRaw } from 'vue-router'
import { getFileIcon } from '~/utils/file-icons'

const props = defineProps<{
  tree: PackageFileTree[]
  currentPath: string
  baseUrl: string
  /** Base path segments for the code route (e.g., ['nuxt', 'v', '4.2.0']) */
  basePath: string[]
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)

// Check if a node or any of its children is currently selected
function isNodeActive(node: PackageFileTree): boolean {
  if (props.currentPath === node.path) return true
  if (props.currentPath.startsWith(node.path + '/')) return true
  return false
}

// Build route object for a file path
function getFileRoute(nodePath: string): RouteLocationRaw {
  const pathSegments = [...props.basePath, ...nodePath.split('/')]
  return {
    name: 'code',
    params: { path: pathSegments as [string, ...string[]] },
  }
}

const { toggleDir, isExpanded, autoExpandAncestors } = useFileTreeState(props.baseUrl)

// Auto-expand directories in the current path
watch(
  () => props.currentPath,
  path => {
    if (path) {
      autoExpandAncestors(path)
    }
  },
  { immediate: true },
)
</script>

<template>
  <ul class="list-none m-0 p-0" :class="depth === 0 ? 'py-2' : ''">
    <li v-for="node in tree" :key="node.path">
      <!-- Directory -->
      <template v-if="node.type === 'directory'">
        <ButtonBase
          class="w-full justify-start! rounded-none! border-none!"
          block
          :aria-pressed="isNodeActive(node)"
          :style="{ paddingLeft: `${depth * 12 + 12}px` }"
          @click="toggleDir(node.path)"
          :classicon="isExpanded(node.path) ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right'"
        >
          <span
            class="w-4 h-4 shrink-0"
            :class="
              isExpanded(node.path)
                ? 'i-carbon:folder-open text-yellow-500'
                : 'i-carbon:folder text-yellow-600'
            "
          />
          <span class="truncate">{{ node.name }}</span>
        </ButtonBase>
        <CodeFileTree
          v-if="isExpanded(node.path) && node.children"
          :tree="node.children"
          :current-path="currentPath"
          :base-url="baseUrl"
          :base-path="basePath"
          :depth="depth + 1"
        />
      </template>

      <!-- File -->
      <template v-else>
        <LinkBase
          variant="button-secondary"
          :to="getFileRoute(node.path)"
          :aria-current="currentPath === node.path"
          class="w-full justify-start! rounded-none! border-none!"
          block
          :style="{ paddingLeft: `${depth * 12 + 32}px` }"
          :classicon="getFileIcon(node.name)"
        >
          <span class="truncate">{{ node.name }}</span>
        </LinkBase>
      </template>
    </li>
  </ul>
</template>
