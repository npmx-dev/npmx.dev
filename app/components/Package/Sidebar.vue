<script setup lang="ts">
const APP_HEADER_HEIGHT = 56

const viewport = useWindowSize()
const scroll = useWindowScroll()
const container = useTemplateRef<HTMLDivElement>('container')
const content = useTemplateRef<HTMLDivElement>('content')
const bounds = useElementBounding(content)
const packageHeaderHeight = usePackageHeaderHeight()
const stickyTop = computed(() => APP_HEADER_HEIGHT + packageHeaderHeight.value)

const active = computed(() => {
  return bounds.height.value > viewport.height.value - stickyTop.value
})

const direction = computed((previous = 'up'): string => {
  if (!active.value) return 'up'
  return scroll.directions.bottom ? 'down' : scroll.directions.top ? 'up' : previous
})

const offset = computed(() => {
  if (!active.value) return 0
  if (!container.value) return 0
  if (!content.value) return 0

  return direction.value === 'down'
    ? content.value.offsetTop
    : container.value.offsetHeight - content.value.offsetTop - content.value.offsetHeight
})
const stickyStyle = computed(() =>
  direction.value === 'up' ? { top: `${stickyTop.value}px` } : { bottom: `32px` },
)

const style = computed(() => {
  return direction.value === 'down'
    ? { paddingBlockStart: `${offset.value}px` }
    : { paddingBlockEnd: `${offset.value}px` }
})
</script>

<template>
  <div
    ref="container"
    class="group relative data-[active=true]:flex"
    :data-direction="direction"
    :data-active="active"
    :style="style"
  >
    <div
      ref="content"
      class="sticky w-full group-data-[direction=up]:(self-start top-30 xl:top-14) group-data-[direction=down]:(self-end bottom-8)"
      :style="stickyStyle"
    >
      <slot />
    </div>
  </div>
</template>
