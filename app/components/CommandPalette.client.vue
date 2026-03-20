<script setup lang="ts">
import type { CommandPaletteCommand, CommandPaletteLinkCommand } from '~/types/command-palette'

const { announcement, isOpen, query, close, toggle, setView, view } = useCommandPalette()
const {
  groupedCommands,
  flatCommands,
  hasResults,
  submitSearchQuery,
  trailingCommands,
  trimmedQuery,
  viewMeta,
} = useCommandPaletteCommands()
const keyboardShortcuts = useKeyboardShortcuts()
const route = useRoute()

const modalRef = useTemplateRef<{
  showModal: () => void
  close: () => void
}>('modalRef')
const inputRef = useTemplateRef<{
  focus: () => void
}>('inputRef')
const nuxtLinkComponent = resolveComponent('NuxtLink')

const activeIndex = shallowRef(-1)
const previouslyFocused = shallowRef<HTMLElement | null>(null)

const dialogId = 'command-palette-modal'
const inputId = `${dialogId}-input`
const descriptionId = `${dialogId}-description`
const statusId = `${dialogId}-status`
const announcementId = `${dialogId}-announcement`
const resultsId = `${dialogId}-results`

const inputDescribedBy = computed(() => `${descriptionId} ${statusId}`)
const statusContextLabel = computed(() =>
  view.value === 'root' ? $t('command_palette.title') : viewMeta.value.placeholder,
)

const statusMessage = computed(() => {
  const count = flatCommands.value.length

  if (!count && trimmedQuery.value) {
    return $t('command_palette.status.no_matches_search_in_context', {
      context: statusContextLabel.value,
      query: trimmedQuery.value,
    })
  }

  if (trimmedQuery.value) {
    return $t(
      'command_palette.status.matching_in_context',
      { context: statusContextLabel.value, count },
      count,
    )
  }

  return $t(
    'command_palette.status.available_in_context',
    { context: statusContextLabel.value, count },
    count,
  )
})

const commandIndexMap = computed(() => {
  return new Map(flatCommands.value.map((command, index) => [command.id, index]))
})

function getDialog() {
  return document.querySelector<HTMLDialogElement>(`#${dialogId}`)
}

function getInputElement() {
  return document.querySelector<HTMLInputElement>(`#${inputId}`)
}

function isInputEventTarget(target: EventTarget | null) {
  const input = getInputElement()
  return !!input && (target === input || document.activeElement === input)
}

function getCommandElements() {
  return Array.from(getDialog()?.querySelectorAll<HTMLElement>('[data-command-item="true"]') ?? [])
}

function getCommandElement(commandId: string) {
  return getCommandElements().find(element => element.dataset.commandId === commandId) ?? null
}

function focusInput() {
  inputRef.value?.focus()
}

function focusCommand(index: number) {
  const elements = getCommandElements()
  const element = elements[index]
  if (!element) return

  activeIndex.value = index
  element.focus()
}

async function handleCommandSelect(command: CommandPaletteCommand) {
  if (isLinkCommand(command)) {
    const element = getCommandElement(command.id)
    if (element) {
      element.click()
      return
    }

    close()
    if ('to' in command) {
      await navigateTo(command.to)
      return
    }

    await navigateTo(command.href, { external: true })
    return
  }

  await command.action()
}

function isLinkCommand(command: CommandPaletteCommand): command is CommandPaletteLinkCommand {
  return command.to != null || command.href != null
}

function getCommandComponent(command: CommandPaletteCommand) {
  if (command.to) return nuxtLinkComponent
  if (command.href) return 'a'
  return 'button'
}

function getCommandAttrs(command: CommandPaletteCommand) {
  if (command.to) {
    return {
      to: command.to,
    }
  }

  if (command.href) {
    return {
      href: command.href,
      target: '_blank',
      rel: 'noopener noreferrer',
    }
  }

  return {
    type: 'button' as const,
  }
}

function handleCommandClick(command: CommandPaletteCommand) {
  if (isLinkCommand(command)) {
    close()
    return
  }

  void handleCommandSelect(command)
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.isComposing) return

  const isToggleShortcut =
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey

  if (isToggleShortcut) {
    if (!keyboardShortcuts.value) return

    event.preventDefault()
    toggle()
    return
  }

  if (!isOpen.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const currentIndex = getCommandElements().findIndex(el => el === document.activeElement)
    const nextIndex =
      currentIndex < 0 ? 0 : Math.min(currentIndex + 1, flatCommands.value.length - 1)
    focusCommand(nextIndex)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const currentIndex = getCommandElements().findIndex(el => el === document.activeElement)
    if (currentIndex <= 0) {
      activeIndex.value = -1
      focusInput()
      return
    }

    focusCommand(currentIndex - 1)
    return
  }

  if (
    event.key === 'ArrowLeft' &&
    viewMeta.value.canGoBack &&
    !query.value &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    isInputEventTarget(event.target)
  ) {
    event.preventDefault()
    handleBack()
    return
  }

  if (event.key === 'Enter' && isInputEventTarget(event.target)) {
    const firstCommand = flatCommands.value[0]
    if (!firstCommand) {
      if (!trimmedQuery.value) return

      event.preventDefault()
      void submitSearchQuery()
      return
    }

    event.preventDefault()
    void handleCommandSelect(firstCommand)
  }
}

function handleDialogClose() {
  if (isOpen.value) {
    close()
    return
  }

  activeIndex.value = -1
  previouslyFocused.value?.focus()
  previouslyFocused.value = null
}

function handleBack() {
  setView('root')
}

watch(
  isOpen,
  async open => {
    const dialog = getDialog()

    if (open) {
      previouslyFocused.value =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      if (!dialog?.open) {
        modalRef.value?.showModal()
      }
      await nextTick()
      focusInput()
      activeIndex.value = -1
      return
    }

    if (dialog?.open) {
      modalRef.value?.close()
      return
    }

    activeIndex.value = -1
    previouslyFocused.value?.focus()
    previouslyFocused.value = null
  },
  { flush: 'post' },
)

watch(
  () => route.fullPath,
  () => {
    if (isOpen.value) {
      close()
    }
  },
)

watch(query, () => {
  activeIndex.value = -1
})

useEventListener(document, 'keydown', handleGlobalKeydown)
</script>

<template>
  <div>
    <p :id="announcementId" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ announcement }}
    </p>

    <Modal
      ref="modalRef"
      :id="dialogId"
      :modalTitle="$t('command_palette.title')"
      :modalSubtitle="viewMeta.subtitle"
      class="mx-auto mb-0 mt-4 max-w-[48rem] overflow-hidden p-0 sm:mt-[10vh]"
      @close="handleDialogClose"
    >
      <div v-if="isOpen" class="-mx-6 -mt-6">
        <p :id="descriptionId" class="sr-only">
          {{ $t('command_palette.instructions') }}
        </p>
        <p :id="statusId" class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {{ statusMessage }}
        </p>

        <div class="border-b border-border/70 bg-bg-subtle/60 px-4 py-4 sm:px-5">
          <button
            v-if="viewMeta.canGoBack"
            type="button"
            class="mb-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-2.5 py-1.5 text-sm text-fg-muted lowercase transition-colors duration-150 hover:border-border/70 hover:bg-bg hover:text-fg focus-visible:outline-accent/70"
            @click="handleBack"
          >
            <span
              class="i-lucide:arrow-left rtl-flip inline-block h-3.5 w-3.5"
              aria-hidden="true"
            />
            {{ $t('command_palette.back') }}
          </button>
          <label :for="inputId" class="sr-only">{{ $t('command_palette.input_label') }}</label>
          <InputBase
            :id="inputId"
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="viewMeta.placeholder"
            no-correct
            size="lg"
            class="w-full"
            :aria-describedby="inputDescribedBy"
            :aria-controls="resultsId"
          />
        </div>

        <div
          :id="resultsId"
          class="max-h-[60vh] overflow-y-auto bg-bg-muted/30 px-2 py-2 sm:px-3 sm:py-3"
          :aria-label="$t('command_palette.results_label')"
          role="region"
        >
          <div
            v-if="!hasResults"
            class="mx-1 rounded-xl border border-border/70 bg-bg-subtle/70 px-4 py-8 text-center sm:mx-0"
          >
            <p class="text-base text-fg-muted lowercase">
              {{ $t('command_palette.empty') }}
            </p>
            <p v-if="trimmedQuery" class="mt-2 text-sm text-fg-subtle">
              {{ $t('command_palette.empty_search_hint', { query: trimmedQuery }) }}
            </p>
          </div>

          <div v-else class="flex flex-col gap-3">
            <section
              v-for="group in groupedCommands"
              :key="group.id"
              :aria-labelledby="`${dialogId}-group-${group.id}`"
              class="rounded-xl border border-border/70 bg-bg-subtle/70 p-1 sm:p-1.5"
            >
              <h3
                :id="`${dialogId}-group-${group.id}`"
                class="px-3 pb-2 pt-2 text-sm uppercase tracking-[0.14em] text-fg-subtle"
              >
                {{ group.label }}
              </h3>

              <ul class="m-0 flex list-none flex-col gap-1 p-0">
                <li v-for="command in group.items" :key="command.id">
                  <component
                    :is="getCommandComponent(command)"
                    v-bind="getCommandAttrs(command)"
                    class="block min-h-12 w-full rounded-lg border border-transparent px-3 py-2 text-start no-underline text-inherit transition-colors duration-150 hover:border-border/80 hover:bg-bg focus-visible:outline-accent/70"
                    :class="
                      activeIndex === (commandIndexMap.get(command.id) ?? -1)
                        ? 'border-border/80 bg-bg'
                        : ''
                    "
                    data-command-item="true"
                    :data-command-id="command.id"
                    :aria-current="command.active ? 'true' : undefined"
                    @click="handleCommandClick(command)"
                    @focus="activeIndex = commandIndexMap.get(command.id) ?? -1"
                    @mouseenter="activeIndex = commandIndexMap.get(command.id) ?? -1"
                  >
                    <span class="flex items-center gap-3">
                      <span
                        class="inline-block h-4 w-4 shrink-0 text-fg-subtle"
                        :class="command.iconClass"
                        aria-hidden="true"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-base text-fg lowercase">
                          {{ command.label }}
                        </span>
                      </span>
                      <span
                        v-if="command.badge"
                        class="hidden rounded-lg border border-border/70 bg-bg px-2.5 py-1 text-sm text-fg-muted lowercase sm:inline-flex"
                      >
                        {{ command.badge }}
                      </span>
                      <span
                        v-if="command.active"
                        class="hidden rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-sm text-accent lowercase sm:inline-flex"
                      >
                        {{ command.activeLabel || $t('command_palette.current') }}
                      </span>
                      <span
                        v-if="command.previewColor"
                        class="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border/70"
                        data-command-preview="true"
                        :style="{ backgroundColor: command.previewColor }"
                        aria-hidden="true"
                      />
                      <span
                        v-if="'href' in command"
                        class="i-lucide:external-link inline-block h-3.5 w-3.5 shrink-0 text-fg-subtle"
                        aria-hidden="true"
                      />
                      <span v-if="'href' in command" class="sr-only">
                        {{ $t('command_palette.links.external') }}
                      </span>
                    </span>
                  </component>
                </li>
              </ul>
            </section>

            <ul v-if="trailingCommands.length" class="m-0 flex list-none flex-col gap-1 p-0">
              <li v-for="command in trailingCommands" :key="command.id">
                <component
                  :is="getCommandComponent(command)"
                  v-bind="getCommandAttrs(command)"
                  class="block min-h-12 w-full rounded-xl border border-border/70 bg-bg-subtle/70 px-3 py-2 text-start no-underline text-inherit transition-colors duration-150 hover:border-border/80 hover:bg-bg focus-visible:outline-accent/70"
                  :class="
                    activeIndex === (commandIndexMap.get(command.id) ?? -1)
                      ? 'border-border/80 bg-bg'
                      : ''
                  "
                  data-command-item="true"
                  :data-command-id="command.id"
                  :aria-current="command.active ? 'true' : undefined"
                  @click="handleCommandClick(command)"
                  @focus="activeIndex = commandIndexMap.get(command.id) ?? -1"
                  @mouseenter="activeIndex = commandIndexMap.get(command.id) ?? -1"
                >
                  <span class="flex items-center gap-3">
                    <span
                      class="inline-block h-4 w-4 shrink-0 text-fg-subtle"
                      :class="command.iconClass"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-base text-fg lowercase">
                        {{ command.label }}
                      </span>
                    </span>
                  </span>
                </component>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>
