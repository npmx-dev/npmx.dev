<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { RouteNamedMap } from 'vue-router/auto-routes'
import { ADDITIONAL_ICONS, getFileIcon } from '~/utils/file-icons'
import { isPossiblyUnnecessaryContent } from '~/utils/package-content-hints'

const props = defineProps<{
  tree: PackageFileTree[]
  currentPath: string
  baseUrl: string
  baseRoute: Pick<RouteNamedMap['code'], 'params'>
  depth?: number
}>()

const depth = computed(() => props.depth ?? 0)
const treeRoot = useTemplateRef('treeRoot')

// Check if a node or any of its children is currently selected
function isNodeActive(node: PackageFileTree): boolean {
  if (props.currentPath === node.path) return true
  if (props.currentPath.startsWith(node.path + '/')) return true
  return false
}

// Build route object for a file path
function getFileRoute(nodePath: string): RouteLocationRaw {
  return {
    name: 'code',
    params: {
      org: props.baseRoute.params.org,
      packageName: props.baseRoute.params.packageName,
      version: props.baseRoute.params.version,
      filePath: nodePath ?? '',
    },
  }
}

const { toggleDir, isExpanded, autoExpandAncestors } = useFileTreeState(props.baseUrl)

const scrollIntoView = () => {
  const el = treeRoot.value?.querySelector<HTMLElement>('[aria-current="true"]')
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

// Auto-expand directories in the current path
watch(
  () => props.currentPath,
  path => {
    if (depth.value === 0 && path) {
      autoExpandAncestors(path)
      nextTick(scrollIntoView)
    }
  },
  { immediate: true },
)
</script>

<template>
  <ul ref="treeRoot" class="list-none m-0 p-0" :class="depth === 0 ? 'py-2' : ''">
    <li v-for="node in tree" :key="node.path">
      <!-- Directory -->
      <template v-if="node.type === 'directory'">
        <ButtonBase
          class="w-full justify-start! rounded-none! border-none! transition-[color,background-color]! duration-100!"
          block
          :aria-pressed="isNodeActive(node)"
          :aria-label="
            isPossiblyUnnecessaryContent(node.name, 'directory')
              ? `${node.name} - ${$t('code.possibly_unnecessary')}`
              : undefined
          "
          :style="{ paddingLeft: `${depth * 12 + 12}px` }"
          @click="toggleDir(node.path)"
          :classicon="isExpanded(node.path) ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'"
        >
          <svg
            class="size-[1em] me-1 shrink-0"
            :class="isExpanded(node.path) ? 'text-yellow-500' : 'text-yellow-600'"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <use
              :href="`/file-tree-sprite.svg#${isExpanded(node.path) ? ADDITIONAL_ICONS['folder-open'] : ADDITIONAL_ICONS['folder']}`"
            />
          </svg>
          <span
            class="truncate"
            :class="
              isPossiblyUnnecessaryContent(node.name, 'directory')
                ? 'text-yellow-600 dark:text-yellow-400'
                : undefined
            "
            >{{ node.name }}</span
          >
          <span
            v-if="isPossiblyUnnecessaryContent(node.name, 'directory')"
            class="i-lucide:info size-[0.85em] ms-1 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
            :title="$t('code.possibly_unnecessary')"
          />
        </ButtonBase>
        <CodeFileTree
          v-if="isExpanded(node.path) && node.children"
          :tree="node.children"
          :current-path="currentPath"
          :base-url="baseUrl"
          :base-route="baseRoute"
          :depth="depth + 1"
        />
      </template>

      <!-- File -->
      <template v-else>
        <LinkBase
          variant="button-secondary"
          :to="getFileRoute(node.path)"
          :aria-current="currentPath === node.path"
          :aria-label="
            isPossiblyUnnecessaryContent(node.name, 'file')
              ? `${node.name} - ${$t('code.possibly_unnecessary')}`
              : undefined
          "
          class="w-full justify-start! rounded-none! border-none! transition-[color,background-color]! duration-100!"
          block
          :style="{ paddingLeft: `${depth * 12 + 32}px` }"
        >
          <svg class="size-[1em] me-1 shrink-0" viewBox="0 0 16 16" aria-hidden="true">
            <use :href="`/file-tree-sprite.svg#${getFileIcon(node.name)}`" />
          </svg>
          <span
            class="truncate"
            :class="
              isPossiblyUnnecessaryContent(node.name, 'file')
                ? 'text-yellow-600 dark:text-yellow-400'
                : undefined
            "
            >{{ node.name }}</span
          >
          <span
            v-if="isPossiblyUnnecessaryContent(node.name, 'file')"
            class="i-lucide:info size-[0.85em] ms-1 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
            :title="$t('code.possibly_unnecessary')"
          />
        </LinkBase>
      </template>
    </li>
  </ul>
</template>
