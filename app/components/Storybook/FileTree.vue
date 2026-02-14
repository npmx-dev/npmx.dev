<script setup lang="ts">
import type { StorybookFileTree } from '#shared/types'
import type { RouteLocationRaw } from 'vue-router'
import { getFileIcon } from '~/utils/file-icons'
import { getFirstStoryInDirectory } from '~/utils/storybook-tree'

const props = defineProps<{
  tree: StorybookFileTree[]
  currentStoryId: string | null
  baseUrl: string
  /** Base path segments for the stories route (e.g., ['nuxt', 'v', '4.2.0']) */
  basePath: string[]
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)

// Check if a node or any of its children is currently selected
function isNodeActive(node: StorybookFileTree): boolean {
  if (node.type === 'story' && props.currentStoryId === node.storyId) return true
  if (node.type === 'directory') {
    return props.currentStoryId?.startsWith(node.path + '/') || false
  }
  return false
}

// Build route object for a story
function getStoryRoute(node: StorybookFileTree): RouteLocationRaw {
  if (node.type === 'story') {
    return {
      name: 'stories',
      params: { path: props.basePath },
      query: { storyid: node.storyId },
    }
  }
  // For directories - navigate to first story in that directory
  if (node.type === 'directory') {
    const firstStory = getFirstStoryInDirectory(node)
    if (firstStory) {
      return {
        name: 'stories',
        params: { path: props.basePath },
        query: { storyid: firstStory.storyId },
      }
    }
  }
  return { name: 'stories', params: { path: props.basePath } }
}

// Get icon for story or directory
function getNodeIcon(node: StorybookFileTree): string {
  if (node.type === 'directory') {
    return isNodeActive(node)
      ? 'i-carbon:folder-open text-yellow-500'
      : 'i-carbon:folder text-yellow-600'
  }

  if (node.storyId) {
    // Try to get icon based on story file type if available
    if (node.story?.importPath) {
      return getFileIcon(node.story.importPath)
    }
    // Default story icon
    return 'i-vscode-icons-file-type-storybook'
  }

  return getFileIcon(node.name)
}

const { toggleDir, isExpanded, autoExpandAncestors } = useStoryTreeState(props.baseUrl)

// Handle directory click - toggle expansion and navigate to first story
function handleDirectoryClick(node: StorybookFileTree) {
  if (node.type !== 'directory') return

  // Toggle directory expansion
  toggleDir(node.path)

  // Navigate to first story in directory (if available)
  const route = getStoryRoute(node)
  if (route.query?.storyid) {
    navigateTo(route)
  }
}
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
          @click="handleDirectoryClick(node)"
          :classicon="isExpanded(node.path) ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right'"
        >
          <span class="w-4 h-4 shrink-0" :class="getNodeIcon(node)" />
          <span class="truncate">{{ node.name }}</span>
        </ButtonBase>
        <StorybookFileTree
          v-if="isExpanded(node.path) && node.children"
          :tree="node.children"
          :current-story-id="currentStoryId"
          :base-url="baseUrl"
          :base-path="basePath"
          :depth="depth + 1"
        />
      </template>

      <!-- Story -->
      <template v-else>
        <LinkBase
          variant="button-secondary"
          :to="getStoryRoute(node)"
          :aria-current="currentStoryId === node.storyId"
          class="w-full justify-start! rounded-none! border-none!"
          block
          :style="{ paddingLeft: `${depth * 12 + 32}px` }"
          :classicon="getNodeIcon(node)"
        >
          <span class="truncate">{{ node.name }}</span>
        </LinkBase>
      </template>
    </li>
  </ul>
</template>
