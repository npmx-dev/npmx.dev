<script setup lang="ts">
import { shallowRef } from 'vue'
import type { IconClass } from '~/types/icon'

interface Props {
  title: string
  subtitle?: string
  isLoading?: boolean
  headingLevel?: `h${number}`
  id: string
  icon?: IconClass
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  headingLevel: 'h2',
})

const appSettings = useSettings()

const buttonId = `${props.id}-collapsible-button`
const contentId = `${props.id}-collapsible-content`

const isOpen = shallowRef(true)

onPrehydrate(() => {
  const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const collapsed: string[] = settings?.sidebar?.collapsed || []
  for (const id of collapsed) {
    if (!document.documentElement.dataset.collapsed?.split(' ').includes(id)) {
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
    isOpen.value = !(
      document.documentElement.dataset.collapsed?.split(' ').includes(props.id) ?? false
    )
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

const { copied: linkCopied, copy: copyLink } = useClipboard({ copiedDuring: 2000 })

function copySectionLink() {
  const url = new URL(window.location.href)
  url.hash = props.id
  copyLink(url.toString())
}

useHead({
  style: [
    {
      innerHTML: `
:root[data-collapsed~='${props.id}'] section[data-anchor-id='${props.id}'] .collapsible-content {
  grid-template-rows: 0fr;
  overflow: hidden;
}`,
    },
  ],
})
</script>

<template>
  <section :id="id" :data-anchor-id="id" class="scroll-mt-20 xl:scroll-mt-0">
    <div class="flex items-center justify-between mb-3 ps-1">
      <div class="flex gap-1 min-w-0" :class="subtitle ? 'items-start' : 'items-center'">
        <component
          :is="headingLevel"
          class="text-xs text-fg-subtle uppercase tracking-wider min-w-0"
        >
          <button
            :id="buttonId"
            type="button"
            class="cursor-pointer flex items-center gap-2 text-start uppercase text-fg-subtle hover:text-fg-muted transition-colors duration-200 focus-visible:outline-accent/70 rounded"
            :aria-expanded="isOpen"
            :aria-controls="contentId"
            @click="toggle"
          >
            <span
              v-if="isLoading"
              class="i-svg-spinners:ring-resize w-3 h-3 shrink-0"
              aria-hidden="true"
            />
            <span
              v-else
              class="w-3 h-3 shrink-0 transition-transform duration-200"
              :class="isOpen ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'"
              aria-hidden="true"
            />
            {{ title }}
          </button>
          <!-- Aligned with the title, past the chevron (w-3) and its gap (gap-2) -->
          <span v-if="subtitle" class="block ps-5 text-2xs normal-case tracking-normal">{{
            subtitle
          }}</span>
        </component>

        <button
          type="button"
          class="cursor-pointer size-5 shrink-0 flex items-center justify-center text-fg-subtle hover:text-fg-muted transition-colors duration-200 focus-visible:outline-accent/70 rounded"
          :aria-label="
            linkCopied
              ? $t('common.section_link_copied')
              : $t('common.copy_section_link', { name: title })
          "
          @click="copySectionLink"
        >
          <span
            class="w-3 h-3"
            :class="linkCopied ? 'i-lucide:check' : 'i-lucide:link'"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- Actions slot for buttons or other elements -->
      <div class="pe-1">
        <slot name="actions" />
      </div>
    </div>

    <div
      :id="contentId"
      class="grid ms-6 ps-1 grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-in-out collapsible-content"
      :inert="!isOpen"
    >
      <div class="min-h-0 min-w-0">
        <slot />
      </div>
    </div>
  </section>
</template>
