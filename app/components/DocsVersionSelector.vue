<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { compare } from 'semver'

const props = defineProps<{
  packageName: string
  currentVersion: string
  versions: Record<string, unknown>
  distTags: Record<string, string>
}>()

const isOpen = ref(false)
const dropdownRef = useTemplateRef('dropdownRef')
const listboxRef = useTemplateRef('listboxRef')
const focusedIndex = ref(-1)

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

/** Maximum number of versions to show in dropdown */
const MAX_VERSIONS = 10

/** Safe version comparison that falls back to string comparison on error */
function safeCompareVersions(a: string, b: string): number {
  try {
    return compare(a, b)
  } catch {
    return a.localeCompare(b)
  }
}

/** Get sorted list of recent versions with their tags */
const recentVersions = computed(() => {
  const versionList = Object.keys(props.versions)
    .sort((a, b) => safeCompareVersions(b, a))
    .slice(0, MAX_VERSIONS)

  // Create a map of version -> tags
  const versionTags = new Map<string, string[]>()
  for (const [tag, version] of Object.entries(props.distTags)) {
    const existing = versionTags.get(version)
    if (existing) {
      existing.push(tag)
    } else {
      versionTags.set(version, [tag])
    }
  }

  return versionList.map(version => ({
    version,
    tags: versionTags.get(version) ?? [],
    isCurrent: version === props.currentVersion,
  }))
})

const latestVersion = computed(() => props.distTags.latest)

function getDocsUrl(version: string): string {
  return `/docs/${props.packageName}/v/${version}`
}

function handleButtonKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  } else if (event.key === 'ArrowDown' && !isOpen.value) {
    event.preventDefault()
    isOpen.value = true
    focusedIndex.value = 0
  }
}

function handleListboxKeydown(event: KeyboardEvent) {
  const items = recentVersions.value

  switch (event.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1)
      scrollToFocused()
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      scrollToFocused()
      break
    case 'Home':
      event.preventDefault()
      focusedIndex.value = 0
      scrollToFocused()
      break
    case 'End':
      event.preventDefault()
      focusedIndex.value = items.length - 1
      scrollToFocused()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (focusedIndex.value >= 0 && focusedIndex.value < items.length) {
        navigateToVersion(items[focusedIndex.value]!.version)
      }
      break
  }
}

function scrollToFocused() {
  nextTick(() => {
    const focused = listboxRef.value?.querySelector('[data-focused="true"]')
    focused?.scrollIntoView({ block: 'nearest' })
  })
}

function navigateToVersion(version: string) {
  isOpen.value = false
  navigateTo(getDocsUrl(version))
}

// Reset focused index when dropdown opens
watch(isOpen, open => {
  if (open) {
    const currentIdx = recentVersions.value.findIndex(v => v.isCurrent)
    focusedIndex.value = currentIdx >= 0 ? currentIdx : 0
  }
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      class="flex items-center gap-1.5 text-fg-subtle font-mono text-sm hover:text-fg transition-[color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
      @click="isOpen = !isOpen"
      @keydown="handleButtonKeydown"
    >
      <span>{{ currentVersion }}</span>
      <span
        v-if="currentVersion === latestVersion"
        class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-sans font-medium"
      >
        latest
      </span>
      <span
        class="i-carbon-chevron-down w-3.5 h-3.5 transition-[transform] duration-200 motion-reduce:transition-none"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-[opacity,transform] duration-100 ease-in motion-reduce:transition-none"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="listboxRef"
        role="listbox"
        tabindex="0"
        :aria-activedescendant="
          focusedIndex >= 0 ? `version-${recentVersions[focusedIndex]?.version}` : undefined
        "
        class="absolute top-full left-0 mt-2 min-w-[180px] bg-bg-elevated border border-border rounded-lg shadow-lg z-50 py-1 max-h-[300px] overflow-y-auto overscroll-contain focus-visible:outline-none"
        @keydown="handleListboxKeydown"
      >
        <NuxtLink
          v-for="({ version, tags, isCurrent }, index) in recentVersions"
          :id="`version-${version}`"
          :key="version"
          :to="getDocsUrl(version)"
          role="option"
          :aria-selected="isCurrent"
          :data-focused="index === focusedIndex"
          class="flex items-center justify-between gap-3 px-3 py-2 text-sm font-mono hover:bg-bg-muted transition-[color,background-color] focus-visible:outline-none focus-visible:bg-bg-muted"
          :class="[
            isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-muted',
            index === focusedIndex ? 'bg-bg-muted' : '',
          ]"
          @click="isOpen = false"
        >
          <span class="truncate">{{ version }}</span>
          <span v-if="tags.length > 0" class="flex items-center gap-1 shrink-0">
            <span
              v-for="tag in tags"
              :key="tag"
              class="text-[10px] px-1.5 py-0.5 rounded font-sans font-medium"
              :class="
                tag === 'latest'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-bg-muted text-fg-subtle'
              "
            >
              {{ tag }}
            </span>
          </span>
        </NuxtLink>

        <div
          v-if="Object.keys(versions).length > MAX_VERSIONS"
          class="border-t border-border mt-1 pt-1 px-3 py-2"
        >
          <NuxtLink
            :to="`/${packageName}`"
            class="text-xs text-fg-subtle hover:text-fg transition-[color] focus-visible:outline-none focus-visible:text-fg"
            @click="isOpen = false"
          >
            View all {{ Object.keys(versions).length }} versions
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>
