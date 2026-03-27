<script setup lang="ts">
defineOptions({ name: 'TabList' })

defineProps<{
  ariaLabel: string
}>()

const listRef = useTemplateRef<HTMLElement>('list')

function onKeydown(event: KeyboardEvent) {
  const el = listRef.value
  if (!el) return

  const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))
  const current = tabs.indexOf(document.activeElement as HTMLElement)
  if (current === -1) return

  let next = -1

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    next = (current + 1) % tabs.length
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    next = (current - 1 + tabs.length) % tabs.length
  } else if (event.key === 'Home') {
    next = 0
  } else if (event.key === 'End') {
    next = tabs.length - 1
  }

  if (next !== -1) {
    event.preventDefault()
    tabs[next]?.focus()
    tabs[next]?.click()
  }
}
</script>

<template>
  <div
    ref="list"
    role="tablist"
    :aria-label
    class="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-subtle p-0.5"
    @keydown="onKeydown"
  >
    <slot />
  </div>
</template>
