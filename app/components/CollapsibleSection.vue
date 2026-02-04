<script setup lang="ts">
import { shallowRef, computed } from 'vue'

interface Props {
  title: string
  isLoading?: boolean
  headingLevel?: `h${number}`
  id: string
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  headingLevel: 'h2',
})

const appSettings = useSettings()

const buttonId = `${props.id}-collapsible-button`
const contentId = `${props.id}-collapsible-content`
const headingId = `${props.id}-heading`

const isOpen = shallowRef(true)

onPrehydrate(() => {
  const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const collapsed: string[] = settings?.sidebar?.collapsed || []
  for (const id of collapsed) {
    if (!document.documentElement.dataset.collapsed?.includes(id)) {
      document.documentElement.dataset.collapsed = (
        document.documentElement.dataset.collapsed +
        ' ' +
        id
      ).trim()
    }
  }
})

onMounted(() => {
  if (document?.documentElement) {
    isOpen.value = !(document.documentElement.dataset.collapsed?.includes(props.id) ?? false)
  }
})

function toggle() {
  isOpen.value = !isOpen.value

  const removed = appSettings.settings.value.sidebar.collapsed.filter(c => c !== props.id)

  if (isOpen.value) {
    appSettings.settings.value.sidebar.collapsed = removed
  } else {
    removed.push(props.id)
    appSettings.settings.value.sidebar.collapsed = removed
  }

  document.documentElement.dataset.collapsed =
    appSettings.settings.value.sidebar.collapsed.join(' ')
}

const ariaLabel = computed(() => {
  const action = isOpen.value ? 'Collapse' : 'Expand'
  return props.title ? `${action} ${props.title}` : action
})
useHead({
  style: [
    {
      innerHTML: `
:root[data-collapsed~='${props.id}'] section[data-anchor-id='${props.id}'] .collapsible-content {
  grid-template-rows: 0fr;
}`,
    },
  ],
})
</script>

<template>
  <section class="scroll-mt-20" :data-anchor-id="id">
    <div class="flex items-center justify-between mb-3 px-1">
      <component
        :is="headingLevel"
        :id="headingId"
        class="group text-xs text-fg-subtle uppercase tracking-wider flex items-center gap-2"
      >
        <button
          :id="buttonId"
          type="button"
          class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg-muted transition-colors duration-200 shrink-0 focus-visible:outline-accent/70 rounded"
          :aria-expanded="isOpen"
          :aria-controls="contentId"
          :aria-label="ariaLabel"
          @click="toggle"
        >
          <span
            v-if="isLoading"
            class="i-carbon:rotate-180 w-3 h-3 motion-safe:animate-spin"
            aria-hidden="true"
          />
          <span
            v-else
            class="w-3 h-3 transition-transform duration-200"
            :class="isOpen ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right'"
            aria-hidden="true"
          />
        </button>

        <a
          :href="`#${id}`"
          class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
        >
          <span v-if="icon" :class="icon" aria-hidden="true" />
          {{ title }}
          <span
            class="i-carbon:link w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            aria-hidden="true"
          />
        </a>
      </component>

      <!-- Actions slot for buttons or other elements -->
      <div class="pe-1">
        <slot name="actions" />
      </div>
    </div>

    <div
      :id="contentId"
      class="grid ms-6 transition-[grid-template-rows] duration-200 ease-in-out collapsible-content overflow-hidden"
      :inert="!isOpen"
    >
      <div class="min-h-0 min-w-0 p-1">
        <slot />
      </div>
    </div>
  </section>
</template>
