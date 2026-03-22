<script setup lang="ts">
import type { PackageFileContentResponse } from '#shared/types/npm-registry'

interface BreadcrumbItem {
  name: string
  path: string
}

const props = defineProps<{
  filePath?: string | null
  loading: boolean
  isViewingFile: boolean
  isBinaryFile: boolean
  fileContent: PackageFileContentResponse | null | undefined
  markdownViewMode: 'preview' | 'code'
  selectedLines: { start: number; end: number } | null
  getCodeUrlWithPath: (path?: string) => string
  packageName: string
  version: string
}>()

const emit = defineEmits<{
  'update:markdownViewMode': [value: 'preview' | 'code']
  'mobile-tree-drawer-toggle': []
}>()

const { codeContainerFull, toggleCodeContainer } = useCodeContainer()

const markdownViewModes = [
  {
    key: 'preview' as const,
    label: $t('code.markdown_view_mode.preview'),
    icon: 'i-lucide:eye',
  },
  {
    key: 'code' as const,
    label: $t('code.markdown_view_mode.code'),
    icon: 'i-lucide:code',
  },
]

// Build breadcrumb path segments
const breadcrumbs = computed<{
  items: BreadcrumbItem[]
  current: string
}>(() => {
  const parts = props.filePath?.split('/').filter(Boolean) ?? []
  const result: {
    items: BreadcrumbItem[]
    current: string
  } = {
    items: [],
    current: parts.at(-1) ?? '',
  }

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (part) {
      result.items.push({
        name: part,
        path: parts.slice(0, i + 1).join('/'),
      })
    }
  }

  return result
})

const { copied: fileContentCopied, copy: copyFileContent } = useClipboard({
  source: () => props.fileContent?.content || '',
  copiedDuring: 2000,
})

// Copy link to current line(s)
const { copied: permalinkCopied, copy: copyPermalink } = useClipboard({ copiedDuring: 2000 })

function copyPermalinkUrl() {
  const url = new URL(window.location.href)
  copyPermalink(url.toString())
}

// Path dropdown (mobile breadcrumb collapse)
const isPathDropdownOpen = shallowRef(false)
const pathDropdownButtonRef = useTemplateRef('pathDropdownButtonRef')
const pathDropdownListRef = useTemplateRef<HTMLElement>('pathDropdownListRef')

function togglePathDropdown(forceClose?: boolean) {
  if (forceClose) {
    isPathDropdownOpen.value = false
    return
  }

  isPathDropdownOpen.value = !isPathDropdownOpen.value
}

onClickOutside(pathDropdownListRef, () => togglePathDropdown(true), {
  ignore: [pathDropdownButtonRef],
})

useEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isPathDropdownOpen.value) {
    togglePathDropdown(true)
  }
})
</script>

<template>
  <div
    class="sticky flex-split h-11 max-md:(h-20 top-32 flex-col items-start) z-5 top-25 gap-0 bg-bg-subtle border-b border-border px-2 py-1 text-nowrap max-w-full"
  >
    <div class="flex items-center w-full h-full relative">
      <!-- Breadcrumb navigation -->
      <nav
        :aria-label="$t('code.file_path')"
        class="flex items-center gap-0.5 font-mono text-sm overflow-x-auto"
        dir="ltr"
      >
        <NuxtLink
          v-if="filePath"
          :to="getCodeUrlWithPath()"
          class="text-fg-muted hover:text-fg transition-colors shrink-0"
        >
          ..
        </NuxtLink>
        <span class="max-md:hidden">
          <template v-for="crumb in breadcrumbs.items" :key="crumb.path">
            <span class="text-fg-subtle">/</span>
            <NuxtLink
              :to="getCodeUrlWithPath(crumb.path)"
              class="text-fg-muted hover:text-fg transition-colors"
            >
              {{ crumb.name }}
            </NuxtLink>
          </template>
        </span>
        <!-- Show dropdown with path elements on small screens -->
        <span v-if="breadcrumbs.items.length" class="md:hidden">
          <span class="text-fg-subtle">/</span>
          <span ref="pathDropdownButtonRef">
            <ButtonBase
              size="sm"
              class="px-2 mx-1"
              :aria-label="$t('code.open_path_dropdown')"
              :aria-expanded="isPathDropdownOpen"
              aria-haspopup="true"
              @click="togglePathDropdown"
            >
              ...
            </ButtonBase>
          </span>
        </span>
        <template v-if="breadcrumbs.current">
          <span class="text-fg-subtle">/</span>
          <span class="text-fg">{{ breadcrumbs.current }}</span>
        </template>
      </nav>
      <Transition
        enter-active-class="transition-all duration-150"
        leave-active-class="transition-all duration-100"
        enter-from-class="opacity-0 translate-y-1"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="isPathDropdownOpen"
          ref="pathDropdownListRef"
          class="absolute top-8 z-50 bg-bg-subtle border border-border rounded-lg shadow-lg py-1 min-w-65 max-w-full font-mono text-sm"
        >
          <NuxtLink
            v-for="(crumb, index) in breadcrumbs.items"
            :key="crumb.path"
            :to="getCodeUrlWithPath(crumb.path)"
            class="flex items-start px-3 py-1 text-fg-muted hover:text-fg hover:bg-bg-muted transition-colors"
            @click="togglePathDropdown(false)"
          >
            <span
              v-for="level in index"
              :key="level"
              aria-hidden="true"
              class="relative h-5 w-4 shrink-0"
            >
              <!-- add └ mark to better visualize nested folders) -->
              <template v-if="level === index">
                <span class="absolute top-0 bottom-1/2 inset-is-2 w-px bg-fg-subtle/50" />
                <span class="absolute top-1/2 inset-is-2 inset-ie-0 h-px bg-fg-subtle/50" />
              </template>
            </span>
            <span :class="{ 'ps-1': index > 0 }" class="min-w-0 break-all"
              >{{ crumb.name }}<span class="text-fg-subtle">/</span></span
            >
          </NuxtLink>
        </div>
      </Transition>
    </div>
    <div class="flex max-md:(w-full justify-between border-border border-t pt-1)">
      <!-- Toggle button (mobile only) -->
      <ButtonBase
        class="md:hidden px-2"
        :aria-label="$t('code.toggle_tree')"
        @click="emit('mobile-tree-drawer-toggle')"
        classicon="i-lucide:folder-code"
      />
      <div class="flex items-center gap-2">
        <template v-if="isViewingFile && !isBinaryFile && fileContent">
          <div
            v-if="fileContent?.markdownHtml"
            class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md overflow-x-auto"
            role="tablist"
            aria-label="Markdown view mode selector"
          >
            <button
              v-for="mode in markdownViewModes"
              :key="mode.key"
              role="tab"
              class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 focus-visible:outline-accent/70 inline-flex items-center gap-1.5"
              :class="
                markdownViewMode === mode.key
                  ? 'bg-bg-muted shadow text-fg'
                  : 'text-fg-subtle hover:text-fg'
              "
              :aria-selected="markdownViewMode === mode.key"
              @click="emit('update:markdownViewMode', mode.key)"
            >
              {{ mode.label }}
            </button>
          </div>
          <ButtonBase
            v-if="selectedLines"
            class="py-1 px-3"
            :classicon="permalinkCopied ? 'i-lucide:check' : 'i-lucide:file-braces-corner'"
            :aria-label="$t('code.copy_link')"
            @click="copyPermalinkUrl"
          />
          <ButtonBase
            v-if="!!fileContent?.content"
            class="px-3"
            :classicon="fileContentCopied ? 'i-lucide:check' : 'i-lucide:copy'"
            :aria-label="$t('code.copy_content')"
            @click="copyFileContent()"
          />
          <LinkBase
            variant="button-secondary"
            :to="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
            class="px-3"
            :aria-label="$t('code.open_raw_file')"
          />
        </template>
        <ButtonBase
          class="px-3 max-xl:hidden"
          :disabled="loading"
          :classicon="codeContainerFull ? 'i-lucide:fold-horizontal' : 'i-lucide:unfold-horizontal'"
          :aria-label="$t('code.toggle_container')"
          @click="toggleCodeContainer()"
        />
      </div>
    </div>
  </div>
</template>
