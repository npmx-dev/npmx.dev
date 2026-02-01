<template>
  <Transition name="fade">
    <div
      class="fixed inset-0 z-[1000] flex items-start justify-center bg-black/50 backdrop-blur-sm"
      v-show="show"
    >
      <div
        class="cmdbar-container flex items-center justify-center border border-border shadow-lg rounded-xl bg-bg p2 flex-col gap-2 mt-5rem"
      >
        <label for="command-input" class="sr-only">command-input</label>

        <search class="relative w-xl h-12 flex items-center">
          <span class="absolute inset-is-4 text-fg-subtle font-mono pointer-events-none"> > </span>
          <input
            type="text"
            v-model="inputVal"
            id="command-input"
            ref="inputRef"
            class="w-full h-full px-4 pl-8 text-fg outline-none bg-bg-subtle border border-border rounded-md"
            :placeholder="placeholderText"
            @keydown="handleKeydown"
          />
        </search>

        <div class="w-xl max-h-lg overflow-auto" v-if="view.type != 'INPUT'">
          <div
            v-for="item in filteredCmdList"
            :key="item.id"
            class="flex-col items-center justify-between px-4 py-2 not-first:mt-2 hover:bg-bg-elevated select-none cursor-pointer rounded-md transition"
            :class="{
              'bg-bg-subtle': item.id === selected,
              'trigger-anim': item.id === triggeringId,
            }"
            @click="onTrigger(item.id)"
          >
            <div class="text-fg">{{ item.name }}</div>
            <div class="text-fg-subtle text-sm">{{ item.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { t } = useI18n()

type ViewState =
  | { type: 'ROOT' }
  | { type: 'INPUT'; prompt: string; resolve: (val: string) => void }
  | { type: 'SELECT'; prompt: string; items: any[]; resolve: (val: any) => void }
const view = ref<ViewState>({ type: 'ROOT' })

const cmdCtx: CommandContext = {
  async input(options) {
    return new Promise(resolve => {
      view.value = { type: 'INPUT', prompt: options.prompt, resolve }
    })
  },
  async select(options) {
    return new Promise(resolve => {
      view.value = { type: 'SELECT', prompt: options.prompt, items: options.items, resolve }
    })
  },
}

const { commands } = useCommandRegistry()

const selected = shallowRef(commands.value[0]?.id || '')
const inputVal = shallowRef('')
const show = shallowRef(false)
const triggeringId = shallowRef('')
const inputRef = useTemplateRef('inputRef')

const { focused: inputFocused } = useFocus(inputRef)

const placeholderText = computed(() => {
  if (view.value.type === 'INPUT' || view.value.type === 'SELECT') {
    return view.value.prompt
  }
  return t('command.placeholder')
})

const filteredCmdList = computed(() => {
  if (view.value.type === 'INPUT') {
    return []
  }

  const list = view.value.type === 'SELECT' ? view.value.items : commands.value

  if (!inputVal.value) {
    return list
  }
  const filter = inputVal.value.trim().toLowerCase()
  return list.filter(
    (item: any) =>
      item.name.toLowerCase().includes(filter) ||
      item.description?.toLowerCase().includes(filter) ||
      item.id.includes(filter),
  )
})

watch(
  () => filteredCmdList.value,
  newVal => {
    if (newVal.length) {
      selected.value = newVal[0]?.id || ''
    }
  },
)

function focusInput() {
  inputFocused.value = true
}

function open() {
  inputVal.value = ''
  selected.value = commands.value[0]?.id || ''
  show.value = true
  view.value = { type: 'ROOT' }
  nextTick(focusInput)
}

function close() {
  inputVal.value = ''
  selected.value = commands.value[0]?.id || ''
  show.value = false
}

function toggle() {
  if (show.value) {
    close()
  } else {
    open()
  }
}

function onTrigger(id: string) {
  triggeringId.value = id

  if (view.value.type === 'ROOT') {
    const selectedItem = filteredCmdList.value.find((item: any) => item.id === id)
    selectedItem?.handler?.(cmdCtx)
    setTimeout(() => {
      triggeringId.value = ''
      if (view.value.type === 'ROOT') {
        close()
      }
    }, 100)
  } else if (view.value.type === 'INPUT') {
    view.value.resolve(inputVal.value)
    close()
  } else if (view.value.type === 'SELECT') {
    const selectedItem = filteredCmdList.value.find((item: any) => item.id === id)
    view.value.resolve(selectedItem)
    close()
  }
}

const handleKeydown = useThrottleFn((e: KeyboardEvent) => {
  if (view.value.type === 'INPUT' && e.key === 'Enter') {
    e.preventDefault()
    onTrigger('') // Trigger for input doesn't need ID
    return
  }

  const currentIndex = filteredCmdList.value.findIndex((item: any) => item.id === selected.value)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = (currentIndex + 1) % filteredCmdList.value.length
    selected.value = filteredCmdList.value[nextIndex]?.id || ''
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIndex =
      (currentIndex - 1 + filteredCmdList.value.length) % filteredCmdList.value.length
    selected.value = filteredCmdList.value[prevIndex]?.id || ''
  } else if (e.key === 'Enter') {
    e.preventDefault()
    onTrigger(selected.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}, 50)

defineExpose({
  open,
  close,
  toggle,
})
</script>

<style scoped>
.fade-enter-active {
  transition: all 0.05s ease-out;
}

.fade-leave-active {
  transition: all 0.1s ease-in;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@keyframes trigger-pulse {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.96);
    background-color: var(--bg-elevated);
  }

  100% {
    transform: scale(1);
  }
}

.trigger-anim {
  animation: trigger-pulse 0.1s ease-in-out;
}
</style>
