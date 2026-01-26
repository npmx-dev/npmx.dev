<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { compareVersions } from '~/utils/versions'

const props = defineProps<{
  packageName: string
  currentVersion: string
  versions: Record<string, unknown>
  distTags: Record<string, string>
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement>()

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

/** Maximum number of versions to show in dropdown */
const MAX_VERSIONS = 10

/** Get sorted list of recent versions with their tags */
const recentVersions = computed(() => {
  const versionList = Object.keys(props.versions)
    .sort((a, b) => compareVersions(b, a))
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

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      class="flex items-center gap-1.5 text-fg-subtle font-mono text-sm hover:text-fg transition-colors"
      @click="isOpen = !isOpen"
      @keydown="handleKeydown"
    >
      <span>{{ currentVersion }}</span>
      <span
        v-if="currentVersion === latestVersion"
        class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-sans font-medium"
      >
        latest
      </span>
      <span
        class="i-carbon-chevron-down w-3.5 h-3.5 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        role="listbox"
        :aria-activedescendant="`version-${currentVersion}`"
        class="absolute top-full left-0 mt-2 min-w-[180px] bg-bg-elevated border border-border rounded-lg shadow-lg z-50 py-1 max-h-[300px] overflow-y-auto"
        @keydown="handleKeydown"
      >
        <NuxtLink
          v-for="{ version, tags, isCurrent } in recentVersions"
          :id="`version-${version}`"
          :key="version"
          :to="getDocsUrl(version)"
          role="option"
          :aria-selected="isCurrent"
          class="flex items-center justify-between gap-3 px-3 py-2 text-sm font-mono hover:bg-bg-muted transition-colors"
          :class="isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-muted'"
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
            class="text-xs text-fg-subtle hover:text-fg transition-colors"
            @click="isOpen = false"
          >
            View all {{ Object.keys(versions).length }} versions
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>
