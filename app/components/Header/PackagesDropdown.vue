<script setup lang="ts">
const props = defineProps<{
  username: string
}>()

const { listUserPackages } = useConnector()

const isOpen = shallowRef(false)
const isLoading = shallowRef(false)
const packages = shallowRef<string[]>([])
const hasLoaded = shallowRef(false)
const error = shallowRef<string | null>(null)

async function loadPackages() {
  if (hasLoaded.value || isLoading.value) return

  isLoading.value = true
  error.value = null
  try {
    const pkgMap = await listUserPackages()
    if (pkgMap) {
      // Sort alphabetically and take top 10
      packages.value = Object.keys(pkgMap).sort().slice(0, 10)
    } else {
      error.value = $t('header.packages_dropdown.error')
    }
    hasLoaded.value = true
  } catch {
    error.value = $t('header.packages_dropdown.error')
  } finally {
    isLoading.value = false
  }
}

function handleMouseEnter() {
  isOpen.value = true
  if (!hasLoaded.value) {
    loadPackages()
  }
}

function handleMouseLeave() {
  isOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}
</script>

<template>
  <div
    class="relative"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeydown"
  >
    <NuxtLink
      :to="`/~${username}`"
      class="link-subtle font-mono text-sm inline-flex items-center gap-1"
    >
      {{ $t('header.packages') }}
      <span
        class="i-carbon-chevron-down w-3 h-3 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </NuxtLink>

    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isOpen" class="absolute inset-ie-0 top-full pt-2 w-64 z-50">
        <div class="bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden">
          <div class="px-3 py-2 border-b border-border">
            <span class="font-mono text-xs text-fg-subtle">{{
              $t('header.packages_dropdown.title')
            }}</span>
          </div>

          <div v-if="isLoading" class="px-3 py-4 text-center">
            <span class="text-fg-muted text-sm">{{ $t('header.packages_dropdown.loading') }}</span>
          </div>

          <div v-else-if="error" class="px-3 py-4 text-center">
            <span class="text-fg-muted text-sm">{{ $t('header.packages_dropdown.error') }}</span>
          </div>

          <ul v-else-if="packages.length > 0" class="py-1 max-h-80 overflow-y-auto">
            <li v-for="pkg in packages" :key="pkg">
              <NuxtLink
                :to="`/${pkg}`"
                class="block px-3 py-2 font-mono text-sm text-fg hover:bg-bg-subtle transition-colors truncate"
              >
                {{ pkg }}
              </NuxtLink>
            </li>
          </ul>

          <div v-else class="px-3 py-4 text-center">
            <span class="text-fg-muted text-sm">{{ $t('header.packages_dropdown.empty') }}</span>
          </div>

          <div class="px-3 py-2 border-t border-border">
            <NuxtLink
              :to="`/~${username}`"
              class="link-subtle font-mono text-xs inline-flex items-center gap-1"
            >
              {{ $t('header.packages_dropdown.view_all') }}
              <span class="i-carbon:arrow-right rtl-flip w-3 h-3" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
