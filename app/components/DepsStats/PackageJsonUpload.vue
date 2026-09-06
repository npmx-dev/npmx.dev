<script setup lang="ts">
const emit = defineEmits<{
  parsed: [file: File, text: string]
  clear: []
}>()

const props = defineProps<{
  fileName?: string | null
  error?: string | null
}>()

const inputRef = useTemplateRef<HTMLInputElement>('inputRef')
const inputId = useId()
const isDragging = shallowRef(false)

async function readFile(file: File) {
  const text = await file.text()
  emit('parsed', file, text)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  void readFile(file)
}

function onDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  void readFile(file)
}

function clearSelection() {
  if (inputRef.value) inputRef.value.value = ''
  emit('clear')
}
</script>

<template>
  <div
    class="relative rounded-lg border border-dashed px-4 py-2 transition-colors h-20 flex items-center justify-center"
    :class="
      isDragging
        ? 'border-accent bg-accent/5'
        : error
          ? 'border-red-500/50 bg-red-500/5'
          : 'border-border hover:border-border-hover'
    "
    @dragenter.prevent="isDragging = true"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <input
      :id="inputId"
      ref="inputRef"
      type="file"
      accept=".json,application/json"
      class="sr-only"
      @change="onFileChange"
    />
    <label :for="inputId" class="absolute inset-0 cursor-pointer">
      <span class="sr-only">{{ $t('deps_stats.upload.label') }}</span>
    </label>
    <div
      v-if="fileName"
      class="relative z-10 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pointer-events-none"
    >
      <p class="text-sm font-mono text-fg-muted">{{ fileName }}</p>
      <ButtonBase
        size="md"
        class="pointer-events-auto"
        :aria-label="$t('deps_stats.upload.clear')"
        @click="clearSelection"
      >
        {{ $t('deps_stats.upload.clear') }}
      </ButtonBase>
    </div>
    <div v-else class="relative z-10 pointer-events-none text-center">
      <p class="text-sm text-fg-subtle">
        {{ $t('deps_stats.upload.hint') }}
      </p>
      <p v-if="error" class="mt-2 text-sm text-red-700 dark:text-red-400" role="alert">
        {{ error }}
      </p>
    </div>
  </div>
</template>
