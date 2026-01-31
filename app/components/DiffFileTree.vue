<script setup lang="ts">
import type { FileChange } from '#shared/types'
import { getFileIcon } from '~/utils/file-icons'

interface DiffTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  changeType?: 'added' | 'removed' | 'modified'
  children?: DiffTreeNode[]
}

const props = defineProps<{
  files: FileChange[]
  selectedPath: string | null
  // Internal props for recursion
  treeNodes?: DiffTreeNode[]
  depth?: number
}>()

const emit = defineEmits<{
  select: [file: FileChange]
}>()

const depth = computed(() => props.depth ?? 0)

// Build tree structure from flat file list (only at root level)
function buildTree(files: FileChange[]): DiffTreeNode[] {
  const root: DiffTreeNode[] = []

  for (const file of files) {
    const parts = file.path.split('/')
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isFile = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')

      let node = current.find(n => n.name === part)
      if (!node) {
        node = {
          name: part,
          path,
          type: isFile ? 'file' : 'directory',
          changeType: isFile ? file.type : undefined,
          children: isFile ? undefined : [],
        }
        current.push(node)
      }

      if (!isFile) {
        current = node.children!
      }
    }
  }

  // Sort: directories first, then alphabetically
  function sortTree(nodes: DiffTreeNode[]): DiffTreeNode[] {
    return nodes
      .map(n => ({
        ...n,
        children: n.children ? sortTree(n.children) : undefined,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  return sortTree(root)
}

// Use provided tree nodes or build from files
const tree = computed(() => props.treeNodes ?? buildTree(props.files))

// Check if a node or any of its children is currently selected
function isNodeActive(node: DiffTreeNode): boolean {
  if (props.selectedPath === node.path) return true
  if (props.selectedPath?.startsWith(node.path + '/')) return true
  return false
}

const expandedDirs = ref<Set<string>>(new Set())

// Auto-expand all directories on mount (only at root level)
onMounted(() => {
  if (props.depth === undefined || props.depth === 0) {
    function collectDirs(nodes: DiffTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'directory') {
          expandedDirs.value.add(node.path)
          if (node.children) collectDirs(node.children)
        }
      }
    }
    collectDirs(tree.value)
  }
})

function toggleDir(path: string) {
  if (expandedDirs.value.has(path)) {
    expandedDirs.value.delete(path)
  } else {
    expandedDirs.value.add(path)
  }
}

function isExpanded(path: string): boolean {
  return expandedDirs.value.has(path)
}

function getChangeIcon(type: 'added' | 'removed' | 'modified') {
  switch (type) {
    case 'added':
      return 'i-carbon-add-alt text-green-500'
    case 'removed':
      return 'i-carbon-subtract-alt text-red-500'
    case 'modified':
      return 'i-carbon-edit text-yellow-500'
  }
}

function handleFileClick(node: DiffTreeNode) {
  const file = props.files.find(f => f.path === node.path)
  if (file) emit('select', file)
}
</script>

<template>
  <ul class="list-none m-0 p-0" :class="depth === 0 ? 'py-2' : ''">
    <li v-for="node in tree" :key="node.path">
      <!-- Directory -->
      <template v-if="node.type === 'directory'">
        <button
          type="button"
          class="w-full flex items-center gap-1.5 py-1.5 px-3 text-start font-mono text-sm transition-colors hover:bg-bg-muted"
          :class="isNodeActive(node) ? 'text-fg' : 'text-fg-muted'"
          :style="{ paddingLeft: `${depth * 12 + 12}px` }"
          @click="toggleDir(node.path)"
        >
          <span
            class="w-4 h-4 shrink-0 transition-transform"
            :class="[isExpanded(node.path) ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right']"
          />
          <span
            class="w-4 h-4 shrink-0"
            :class="
              isExpanded(node.path)
                ? 'i-carbon:folder-open text-yellow-500'
                : 'i-carbon:folder text-yellow-600'
            "
          />
          <span class="truncate">{{ node.name }}</span>
        </button>
        <DiffFileTree
          v-if="isExpanded(node.path) && node.children"
          :files="files"
          :tree-nodes="node.children"
          :selected-path="selectedPath"
          :depth="depth + 1"
          @select="emit('select', $event)"
        />
      </template>

      <!-- File -->
      <template v-else>
        <button
          type="button"
          class="w-full flex items-center gap-1.5 py-1.5 px-3 font-mono text-sm transition-colors hover:bg-bg-muted text-start"
          :class="selectedPath === node.path ? 'bg-bg-muted text-fg' : 'text-fg-muted'"
          :style="{ paddingLeft: `${depth * 12 + 32}px` }"
          @click="handleFileClick(node)"
        >
          <span class="w-4 h-4 shrink-0" :class="getFileIcon(node.name)" />
          <span class="w-3 h-3 shrink-0" :class="getChangeIcon(node.changeType!)" />
          <span class="truncate">{{ node.name }}</span>
        </button>
      </template>
    </li>
  </ul>
</template>
