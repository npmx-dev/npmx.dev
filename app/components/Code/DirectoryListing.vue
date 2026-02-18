<script setup lang="ts">
import type { PackageFileTree } from '#shared/types'
import type { RouteLocationRaw } from 'vue-router'
import type { RouteNamedMap } from 'vue-router/auto-routes'
import { ADDITIONAL_ICONS, getFileIcon } from '~/utils/file-icons'

const props = defineProps<{
  tree: PackageFileTree[]
  currentPath: string
  baseUrl: string
  baseRoute: Pick<RouteNamedMap['code'], 'params'>
}>()

// Get the current directory's contents
const currentContents = computed(() => {
  if (!props.currentPath) {
    return props.tree
  }

  const parts = props.currentPath.split('/')
  let current: PackageFileTree[] | undefined = props.tree

  for (const part of parts) {
    const found: PackageFileTree | undefined = current?.find(n => n.name === part)
    if (!found || found.type === 'file') {
      return []
    }
    current = found.children
  }

  return current ?? []
})

// Get parent directory path
const parentPath = computed(() => {
  if (!props.currentPath) return null
  const parts = props.currentPath.split('/')
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
})

// Build route object for a path
function getCodeRoute(nodePath?: string): RouteLocationRaw {
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

const bytesFormatter = useBytesFormatter()
</script>

<template>
  <div class="directory-listing">
    <!-- Empty state -->
    <div v-if="currentContents.length === 0" class="py-20 text-center text-fg-muted">
      <p>{{ $t('code.no_files') }}</p>
    </div>

    <!-- File list -->
    <table v-else class="w-full">
      <thead class="sr-only">
        <tr>
          <th>{{ $t('code.table.name') }}</th>
          <th>{{ $t('code.table.size') }}</th>
        </tr>
      </thead>
      <tbody>
        <!-- Parent directory link -->
        <tr
          v-if="parentPath !== null"
          class="border-b border-border hover:bg-bg-subtle transition-colors"
        >
          <td colspan="2">
            <LinkBase
              :to="getCodeRoute(parentPath || undefined)"
              class="py-2 px-4 font-mono text-sm w-full"
              no-underline
            >
              <svg
                class="size-[1em] me-1 shrink-0 text-yellow-600"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <use :href="`/file-tree-sprite.svg#${ADDITIONAL_ICONS['folder']}`" />
              </svg>
              <span class="w-full flex justify-self-stretch items-center gap-2"> .. </span>
            </LinkBase>
          </td>
        </tr>

        <!-- Directory/file rows -->
        <tr
          v-for="node in currentContents"
          :key="node.path"
          class="border-b border-border hover:bg-bg-subtle transition-colors"
        >
          <td colspan="2">
            <LinkBase
              :to="getCodeRoute(node.path)"
              class="py-2 px-4 font-mono text-sm w-full"
              no-underline
            >
              <svg
                class="size-[1em] me-1 shrink-0"
                viewBox="0 0 16 16"
                fill="currentColor"
                :class="node.type === 'directory' ? 'text-yellow-600' : undefined"
                aria-hidden="true"
              >
                <use
                  :href="`/file-tree-sprite.svg#${node.type === 'directory' ? ADDITIONAL_ICONS['folder'] : getFileIcon(node.name)}`"
                />
              </svg>
              <span class="w-full flex justify-self-stretch items-center gap-2">
                <span class="flex-1">{{ node.name }}</span>
                <span v-if="typeof node.size === 'number'" class="text-end text-xs text-fg-subtle">
                  {{ bytesFormatter.format(node.size) }}
                </span>
              </span>
            </LinkBase>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
