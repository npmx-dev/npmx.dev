<script setup lang="ts">
import type { GalleryImage } from '~/types/events'

const { images, max = 10 } = defineProps<{ images: GalleryImage[]; max?: number }>()

const open = ref(false)
const index = ref(0)

const visible = computed(() => images.slice(0, max))
const remaining = computed(() => Math.max(0, images.length - max))

function openAt(i: number) {
  index.value = i
  open.value = true
}
function close() {
  open.value = false
}
function prev() {
  index.value = (index.value - 1 + images.length) % images.length
}
function next() {
  index.value = (index.value + 1) % images.length
}

onKeyStroke('Escape', () => open.value && close())
onKeyStroke('ArrowLeft', () => open.value && prev())
onKeyStroke('ArrowRight', () => open.value && next())

watch(open, value => {
  if (import.meta.client) document.body.style.overflow = value ? 'hidden' : ''
})
onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <button
        v-for="(img, i) in visible"
        :key="img.url"
        type="button"
        class="group/tile relative aspect-[4/3] overflow-hidden rounded-lg bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        @click="openAt(i)"
      >
        <img
          :src="img.url"
          :alt="img.alt || ''"
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/tile:scale-105"
        />
        <span
          class="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover/tile:bg-black/15"
          aria-hidden="true"
        />
        <span
          v-if="i === visible.length - 1 && remaining > 0"
          class="absolute inset-0 flex items-center justify-center bg-black/60 font-mono text-lg text-white"
        >
          +{{ remaining }}
        </span>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="open"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('events.gallery')"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
        @click.self="close"
      >
        <button
          type="button"
          class="absolute inset-ie-4 inset-bs-4 z-10 flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:text-white hover:bg-white/10"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <span class="i-lucide:x w-5 h-5" aria-hidden="true" />
        </button>

        <button
          v-if="images.length > 1"
          type="button"
          class="absolute inset-is-2 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
          :aria-label="$t('events.gallery_prev')"
          @click="prev"
        >
          <span class="i-lucide:chevron-left rtl-flip w-6 h-6" aria-hidden="true" />
        </button>
        <button
          v-if="images.length > 1"
          type="button"
          class="absolute inset-ie-2 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10"
          :aria-label="$t('events.gallery_next')"
          @click="next"
        >
          <span class="i-lucide:chevron-right rtl-flip w-6 h-6" aria-hidden="true" />
        </button>

        <img
          :src="images[index]?.url"
          :alt="images[index]?.alt || ''"
          class="max-h-[85vh] max-w-[90vw] object-contain"
        />

        <div class="group/strip absolute inset-x-0 bottom-0 flex justify-center pt-20">
          <div
            class="flex max-w-full translate-y-full gap-2 overflow-x-auto p-3 transition-transform duration-200 group-hover/strip:translate-y-0"
          >
            <button
              v-for="(img, i) in images"
              :key="img.url"
              type="button"
              class="h-14 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition-colors"
              :class="
                i === index ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
              "
              @click="index = i"
            >
              <img :src="img.url" :alt="img.alt || ''" class="h-full w-full object-cover" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
