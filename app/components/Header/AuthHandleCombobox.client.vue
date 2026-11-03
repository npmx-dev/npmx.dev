<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { autoUpdate, flip, offset, size, useFloating } from '@floating-ui/vue'
import type { ActorSearchResult } from '#shared/schemas/atproto'

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  /** Applied to the underlying input so an external <label for> can target it. */
  id?: string
  /** Accessible name; the consuming form may render a visible <label> as well. */
  label: string
  placeholder?: string
}>()

const { actors, isSearching, error, query } = useActorTypeahead(model)

const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)
const containerRef = useTemplateRef('containerRef')
const dropdownRef = useTemplateRef('dropdownRef')
const listRef = useTemplateRef('listRef')

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

const generatedId = useId()
const inputId = computed(() => props.id ?? `auth-handle-${generatedId}`)
const listboxId = computed(() => `${inputId.value}-listbox`)

/** Options are only navigable once a real search has produced matches. */
const options = computed<ActorSearchResult[]>(() => (query.value ? actors.value : []))

const statusMessage = computed(() => {
  if (!query.value) return ''
  if (error.value) return $t('auth.modal.handle_search_unavailable')
  if (isSearching.value && options.value.length === 0) return $t('auth.modal.handle_searching')
  if (!isSearching.value && options.value.length === 0) return $t('auth.modal.handle_no_results')
  return ''
})

const showListbox = computed(() => isOpen.value && options.value.length > 0)
const showDropdown = computed(() => showListbox.value || (isOpen.value && !!statusMessage.value))

// Position the dropdown with `fixed` so the modal's scroll container cannot clip it.
const { floatingStyles } = useFloating(containerRef, dropdownRef, {
  strategy: 'fixed',
  placement: 'bottom-start',
  middleware: [
    offset(4),
    flip(),
    size({
      apply({ rects, elements }) {
        elements.floating.style.width = `${rects.reference.width}px`
      },
    }),
  ],
  whileElementsMounted: autoUpdate,
})

/** Avatars that failed to load (e.g. blocked by CSP) fall back to initials. */
const failedAvatars = reactive(new Set<string>())

function initials(actor: ActorSearchResult) {
  return (actor.displayName || actor.handle)
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function close() {
  isOpen.value = false
  highlightedIndex.value = -1
}

function open() {
  if (!query.value) return
  isOpen.value = true
}

function selectActor(actor: ActorSearchResult) {
  model.value = actor.handle
  close()
}

function moveHighlight(delta: number) {
  const count = options.value.length
  if (count === 0) return
  if (highlightedIndex.value < 0) {
    highlightedIndex.value = delta > 0 ? 0 : count - 1
    return
  }
  highlightedIndex.value = (highlightedIndex.value + delta + count) % count
}

// These are standard combobox keys, not app shortcuts, so they ignore the
// "keyboard shortcuts" setting.
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    // Only dismiss the list; the surrounding <dialog> must stay open.
    if (isOpen.value) {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (options.value.length === 0) return
    event.preventDefault()
    isOpen.value = true
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Home' || event.key === 'End') {
    if (!isOpen.value || options.value.length === 0) return
    event.preventDefault()
    highlightedIndex.value = event.key === 'Home' ? 0 : options.value.length - 1
    return
  }

  if (event.key === 'Enter') {
    const highlighted = options.value[highlightedIndex.value]
    // Without a highlighted row, let the form submit the typed handle.
    if (isOpen.value && highlighted) {
      event.preventDefault()
      selectActor(highlighted)
    }
    return
  }

  if (event.key === 'Tab') close()
}

function handleInput() {
  highlightedIndex.value = -1
  open()
}

function handleFocus() {
  open()
}

onClickOutside(containerRef, close)

// A new result set invalidates any highlight that pointed into the old one.
watch(options, () => {
  highlightedIndex.value = -1
})

// Keep the highlighted row visible inside the scrollable list.
watch(highlightedIndex, index => {
  if (index < 0 || !listRef.value) return
  const item = listRef.value.children[index] as HTMLElement | undefined
  item?.scrollIntoView({ block: 'nearest' })
})

// A programmatic model change (e.g. modal reset) should not leave a stale list open.
watch(model, value => {
  if (!value) close()
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <InputBase
      :id="inputId"
      v-model="model"
      type="text"
      name="handle"
      no-correct
      :placeholder="props.placeholder"
      :aria-label="props.label"
      class="w-full"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :aria-expanded="showListbox"
      :aria-controls="showListbox ? listboxId : undefined"
      :aria-activedescendant="
        highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
      "
      @input="handleInput"
      @focus="handleFocus"
      @keydown="handleKeydown"
    />

    <Transition
      :enter-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-150'"
      :enter-from-class="prefersReducedMotion ? '' : 'opacity-0'"
      enter-to-class="opacity-100"
      :leave-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-100'"
      leave-from-class="opacity-100"
      :leave-to-class="prefersReducedMotion ? '' : 'opacity-0'"
    >
      <div
        v-if="showDropdown"
        ref="dropdownRef"
        :style="floatingStyles"
        class="bg-bg-elevated border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
      >
        <ul
          v-if="showListbox"
          :id="listboxId"
          ref="listRef"
          role="listbox"
          :aria-label="$t('auth.modal.handle_suggestions_label')"
          class="py-1"
        >
          <li
            v-for="(actor, index) in options"
            :id="`${listboxId}-option-${index}`"
            :key="actor.did"
            role="option"
            :aria-selected="highlightedIndex === index"
            class="px-2 py-1.5 cursor-pointer transition-colors duration-100"
            :class="
              highlightedIndex === index
                ? 'bg-accent/15'
                : 'hover:bg-bg-subtle focus-visible:outline-accent/70'
            "
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent
            @click="selectActor(actor)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <!-- Decorative: the name and handle beside it are the accessible text. -->
              <div
                class="shrink-0 w-8 h-8 flex items-center justify-center border border-border rounded-full bg-bg-muted overflow-hidden"
                aria-hidden="true"
              >
                <img
                  v-if="actor.avatar && !failedAvatars.has(actor.did)"
                  :src="actor.avatar"
                  alt=""
                  class="w-full h-full object-cover"
                  @error="failedAvatars.add(actor.did)"
                />
                <span v-else class="text-sm text-fg-subtle font-mono" aria-hidden="true">
                  {{ initials(actor) }}
                </span>
              </div>
              <div class="min-w-0">
                <p v-if="actor.displayName" class="text-sm text-fg truncate">
                  {{ actor.displayName }}
                </p>
                <p
                  class="font-mono text-xs truncate"
                  :class="actor.displayName ? 'text-fg-muted' : 'text-fg'"
                >
                  @{{ actor.handle }}
                </p>
              </div>
            </div>
          </li>
        </ul>

        <p v-else class="px-3 py-2 text-xs text-fg-muted" role="status" aria-live="polite">
          {{ statusMessage }}
        </p>
      </div>
    </Transition>
  </div>
</template>
