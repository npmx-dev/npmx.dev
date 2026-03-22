<script setup lang="ts">
const show = shallowRef(false)
const x = shallowRef(0)
const y = shallowRef(0)
const menuRef = useTemplateRef('menuRef')

function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  x.value = e.clientX
  y.value = e.clientY
  show.value = true
  nextTick(() => {
    menuRef.value?.focus()
    clampPosition()
  })
}

function clampPosition() {
  const el = menuRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    x.value -= rect.right - window.innerWidth + 8
  }
  if (rect.bottom > window.innerHeight) {
    y.value -= rect.bottom - window.innerHeight + 8
  }
}

function close() {
  show.value = false
}

const { copy, copied } = useClipboard({ copiedDuring: 2000 })

async function copySvg() {
  try {
    const res = await fetch('/logo.svg')
    const svg = await res.text()
    await copy(svg)
  } finally {
    close()
  }
}

function goToBrand() {
  close()
  navigateTo({ name: 'brand' })
}

onClickOutside(menuRef, close)

onKeyStroke('Escape', () => {
  if (show.value) close()
})
</script>

<template>
  <div @contextmenu="onContextMenu">
    <slot />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="show"
          ref="menuRef"
          role="menu"
          tabindex="-1"
          class="fixed z-[999] min-w-48 bg-bg-elevated border border-border rounded-lg shadow-lg py-1 origin-top-left focus:outline-none motion-reduce:transition-none"
          :style="{ left: `${x}px`, top: `${y}px` }"
          @keydown.escape="close"
        >
          <ButtonBase
            role="menuitem"
            class="w-full text-start gap-x-3 border-none"
            :classicon="copied ? 'i-lucide:check text-badge-green' : 'i-lucide:copy'"
            @click="copySvg"
          >
            {{ copied ? $t('brand.colors.copied') : $t('logo_menu.copy_svg') }}
          </ButtonBase>
          <ButtonBase
            role="menuitem"
            class="w-full text-start gap-x-3 border-none"
            classicon="i-lucide:palette"
            @click="goToBrand"
          >
            {{ $t('logo_menu.browse_brand') }}
          </ButtonBase>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
