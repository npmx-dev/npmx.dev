<script setup lang="ts">
import type { FileDiffResponse, FileChange, DiffHunk } from '#shared/types'
import { createDiff, insertSkipBlocks, countDiffStats } from '#shared/utils/diff'
import { motion } from 'motion-v'

const props = defineProps<{
  packageName: string
  fromVersion: string
  toVersion: string
  file: FileChange
}>()

const mergeModifiedLines = ref(true)
const maxChangeRatio = ref(0.45)
const maxDiffDistance = ref(30)
const inlineMaxCharEdits = ref(2)
const wordWrap = ref(false)
const showOptions = ref(false)
const loading = ref(true)
const loadError = ref<Error | null>(null)
const diff = ref<FileDiffResponse | null>(null)
const fromContent = ref<string | null>(null)
const toContent = ref<string | null>(null)
const loadToken = ref(0)

const DIFF_TIMEOUT = 15000
const MAX_DIFF_FILE_SIZE = 250 * 1024

const optionsParams = computed(() => ({
  mergeModifiedLines: mergeModifiedLines.value,
  maxChangeRatio: maxChangeRatio.value,
  maxDiffDistance: maxDiffDistance.value,
  inlineMaxCharEdits: inlineMaxCharEdits.value,
}))

const status = computed(() => {
  if (loadError.value) return 'error'
  if (loading.value) return 'pending'
  return 'success'
})

async function fetchFileContent(version: string): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DIFF_TIMEOUT)
  const url = `https://cdn.jsdelivr.net/npm/${props.packageName}@${version}/${props.file.path}`
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to fetch file (status ${res.status})`)

    const length = res.headers.get('content-length')
    if (length && parseInt(length, 10) > MAX_DIFF_FILE_SIZE) {
      throw new Error(
        `File too large to diff (${(parseInt(length, 10) / 1024).toFixed(0)}KB). Maximum is ${
          MAX_DIFF_FILE_SIZE / 1024
        }KB.`,
      )
    }

    const text = await res.text()
    if (text.length > MAX_DIFF_FILE_SIZE) {
      throw new Error(
        `File too large to diff (${(text.length / 1024).toFixed(0)}KB). Maximum is ${
          MAX_DIFF_FILE_SIZE / 1024
        }KB.`,
      )
    }

    return text
  } catch (err) {
    // Provide specific error message for timeout
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${DIFF_TIMEOUT / 1000}s`, { cause: err })
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

function computeDiff() {
  if (loadError.value) return
  if (loading.value && fromContent.value === null && toContent.value === null) return

  const oldContent = fromContent.value ?? ''
  const newContent = toContent.value ?? ''

  // Determine diff type based on content availability
  // Note: FileDiffResponse uses 'add'/'delete'/'modify' while FileChange uses
  // 'added'/'removed'/'modified' - this is intentional to distinguish between
  // the file-level change info (FileChange) and the diff content type (FileDiff)
  let type: FileDiffResponse['type'] = 'modify'
  if (fromContent.value === null && toContent.value !== null) type = 'add'
  else if (fromContent.value !== null && toContent.value === null) type = 'delete'

  const parsed = createDiff(oldContent, newContent, props.file.path, optionsParams.value)

  if (!parsed) {
    diff.value = {
      package: props.packageName,
      from: props.fromVersion,
      to: props.toVersion,
      path: props.file.path,
      type,
      hunks: [],
      stats: { additions: 0, deletions: 0 },
      meta: {},
    }
    return
  }

  const hunksWithSkips = insertSkipBlocks(
    parsed.hunks.filter((h): h is DiffHunk => h.type === 'hunk'),
  )
  const stats = countDiffStats(hunksWithSkips)

  diff.value = {
    package: props.packageName,
    from: props.fromVersion,
    to: props.toVersion,
    path: props.file.path,
    type: parsed.type,
    hunks: hunksWithSkips,
    stats,
    meta: {},
  }
}

async function loadContents() {
  const token = ++loadToken.value
  loading.value = true
  loadError.value = null
  try {
    const [from, to] = await Promise.all([
      fetchFileContent(props.fromVersion),
      fetchFileContent(props.toVersion),
    ])

    if (token !== loadToken.value) return

    fromContent.value = from
    toContent.value = to

    if (from === null && to === null) {
      throw new Error('File not found in either version')
    }

    computeDiff()
  } catch (err) {
    if (token !== loadToken.value) return
    loadError.value = err as Error
    diff.value = null
  } finally {
    if (token === loadToken.value) loading.value = false
  }
}

watch(
  [() => props.file.path, () => props.fromVersion, () => props.toVersion],
  () => {
    loadContents()
  },
  { immediate: true },
)

watch([mergeModifiedLines, maxChangeRatio, maxDiffDistance, inlineMaxCharEdits], () => {
  computeDiff()
})

function calcPercent(value: number, min: number, max: number): number {
  if (max === min) return 0
  const percent = ((value - min) / (max - min)) * 100
  return Math.min(100, Math.max(0, percent))
}

function getStepMarks(min: number, max: number, step: number): number[] {
  const marks: number[] = []
  const range = max - min
  const stepCount = Math.floor(range / step)

  if (stepCount <= 10) {
    for (let i = 1; i <= stepCount; i++) {
      const positionPercent = ((i * step) / range) * 100
      marks.push(positionPercent)
    }
  }

  return marks
}

const changeRatioMarks = computed(() => getStepMarks(0, 1, 0.01))
const diffDistanceMarks = computed(() => getStepMarks(1, 60, 1))
const charEditMarks = computed(() => [] as number[]) // no dots for char edits slider
const changeRatioPercent = computed(() => calcPercent(maxChangeRatio.value, 0, 1))
const diffDistancePercent = computed(() => calcPercent(maxDiffDistance.value, 1, 60))
const charEditPercent = computed(() => calcPercent(inlineMaxCharEdits.value, 0, 10))

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Build code browser URL
function getCodeUrl(version: string): string {
  return `/code/${props.packageName}/v/${version}/${props.file.path}`
}
</script>

<template>
  <div class="h-full flex flex-col bg-bg">
    <!-- Header -->
    <div
      class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-bg-subtle border-b border-border shrink-0"
    >
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- File icon based on type -->
        <span
          :class="[
            'w-4 h-4 shrink-0',
            file.type === 'added'
              ? 'i-carbon-add-alt text-green-500'
              : file.type === 'removed'
                ? 'i-carbon-subtract-alt text-red-500'
                : 'i-carbon-edit text-yellow-500',
          ]"
        />

        <!-- File path -->
        <span class="font-mono text-sm truncate max-w-[65vw] sm:max-w-none">{{ file.path }}</span>

        <!-- Stats -->
        <template v-if="diff?.stats">
          <span v-if="diff.stats.additions > 0" class="text-xs text-green-500 font-mono shrink-0">
            +{{ diff.stats.additions }}
          </span>
          <span v-if="diff.stats.deletions > 0" class="text-xs text-red-500 font-mono shrink-0">
            -{{ diff.stats.deletions }}
          </span>
        </template>

        <!-- File sizes -->
        <span v-if="file.oldSize || file.newSize" class="text-xs text-fg-subtle shrink-0">
          <template v-if="file.type === 'modified'">
            {{ formatBytes(file.oldSize) }} → {{ formatBytes(file.newSize) }}
          </template>
          <template v-else-if="file.type === 'added'">
            {{ formatBytes(file.newSize) }}
          </template>
          <template v-else>
            {{ formatBytes(file.oldSize) }}
          </template>
        </span>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <!-- Options dropdown -->
        <div class="relative">
          <button
            type="button"
            class="px-2 py-1 text-xs text-fg-muted hover:text-fg bg-bg-muted border border-border rounded transition-colors flex items-center gap-1.5"
            :class="{ 'bg-bg-elevated text-fg': showOptions }"
            @click="showOptions = !showOptions"
          >
            <span class="i-carbon-settings w-3.5 h-3.5" />
            Options
            <span
              class="i-carbon-chevron-down w-3 h-3 transition-transform"
              :class="{ 'rotate-180': showOptions }"
            />
          </button>

          <!-- Dropdown menu -->
          <motion.div
            v-if="showOptions"
            class="absolute right-0 top-full mt-2 z-20 p-4 bg-bg-elevated border border-border shadow-2xl overflow-auto"
            :style="{
              width: mergeModifiedLines
                ? 'min(420px, calc(100vw - 24px))'
                : 'min(320px, calc(100vw - 24px))',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: '70vh',
              borderRadius: mergeModifiedLines ? '14px' : '20px',
            }"
            :initial="{ opacity: 0, y: -4, scale: 0.98 }"
            :animate="{ opacity: 1, y: 0, scale: 1 }"
            :transition="{ type: 'spring', stiffness: 550, damping: 45, mass: 0.7 }"
          >
            <div class="flex flex-col gap-2">
              <!-- Merge modified lines toggle -->
              <SettingsToggle label="Merge modified lines" v-model="mergeModifiedLines" />

              <!-- Word wrap toggle -->
              <SettingsToggle label="Word wrap" v-model="wordWrap" />

              <!-- Sliders -->
              <motion.div
                class="flex flex-col gap-2"
                :animate="{ opacity: mergeModifiedLines ? 1 : 0 }"
              >
                <!-- Change ratio slider -->
                <div class="sr-only">
                  <label for="change-ratio">Change ratio</label>
                </div>
                <div
                  class="slider-shell w-full min-w-0"
                  :class="{ 'is-disabled': !mergeModifiedLines }"
                >
                  <div class="slider-labels">
                    <span class="slider-label">Change ratio</span>
                    <span class="slider-value tabular-nums">{{ maxChangeRatio.toFixed(2) }}</span>
                  </div>
                  <div class="slider-track">
                    <div
                      v-for="mark in changeRatioMarks"
                      :key="`cr-${mark}`"
                      class="slider-mark"
                      :style="{ left: `calc(${mark}% - 11px)` }"
                    />
                    <div class="slider-range" :style="{ width: `${changeRatioPercent}%` }" />
                  </div>
                  <input
                    id="change-ratio"
                    v-model.number="maxChangeRatio"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    :disabled="!mergeModifiedLines"
                    class="slider-input"
                  />
                </div>

                <!-- Diff distance slider -->
                <div class="sr-only">
                  <label for="diff-distance">Diff distance</label>
                </div>
                <div
                  class="slider-shell w-full min-w-0"
                  :class="{ 'is-disabled': !mergeModifiedLines }"
                >
                  <div class="slider-labels">
                    <span class="slider-label">Diff distance</span>
                    <span class="slider-value tabular-nums">{{ maxDiffDistance }}</span>
                  </div>
                  <div class="slider-track">
                    <div
                      v-for="mark in diffDistanceMarks"
                      :key="`dd-${mark}`"
                      class="slider-mark"
                      :style="{ left: `calc(${mark}% - 11px)` }"
                    />
                    <div class="slider-range" :style="{ width: `${diffDistancePercent}%` }" />
                  </div>
                  <input
                    id="diff-distance"
                    v-model.number="maxDiffDistance"
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    :disabled="!mergeModifiedLines"
                    class="slider-input"
                  />
                </div>

                <!-- Char edits slider -->
                <div class="sr-only">
                  <label for="char-edits">Char edits</label>
                </div>
                <div
                  class="slider-shell w-full min-w-0"
                  :class="{ 'is-disabled': !mergeModifiedLines }"
                >
                  <div class="slider-labels">
                    <span class="slider-label">Char edits</span>
                    <span class="slider-value tabular-nums">{{ inlineMaxCharEdits }}</span>
                  </div>
                  <div class="slider-track">
                    <div
                      v-for="mark in charEditMarks"
                      :key="`ce-${mark}`"
                      class="slider-mark"
                      :style="{ left: `calc(${mark}% - 11px)` }"
                    />
                    <div class="slider-range" :style="{ width: `${charEditPercent}%` }" />
                  </div>
                  <input
                    id="char-edits"
                    v-model.number="inlineMaxCharEdits"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    :disabled="!mergeModifiedLines"
                    class="slider-input"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

        <!-- View in code browser -->
        <NuxtLink
          v-if="file.type !== 'removed'"
          :to="getCodeUrl(toVersion)"
          class="px-2 py-1 text-xs text-fg-muted hover:text-fg bg-bg-muted border border-border rounded transition-colors"
          target="_blank"
        >
          View file
        </NuxtLink>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto relative">
      <!-- Loading state -->
      <div v-if="status === 'pending'" class="py-12 text-center">
        <div class="i-svg-spinners-ring-resize w-6 h-6 mx-auto text-fg-muted" />
        <p class="mt-2 text-sm text-fg-muted">Loading diff...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="status === 'error'" class="py-8 text-center">
        <span class="i-carbon-warning-alt w-8 h-8 mx-auto text-fg-subtle mb-2 block" />
        <p class="text-fg-muted text-sm mb-2">
          {{ loadError?.message || 'Failed to load diff' }}
        </p>
        <div class="flex items-center justify-center gap-2">
          <NuxtLink
            v-if="file.type !== 'removed'"
            :to="getCodeUrl(toVersion)"
            class="text-xs text-fg-muted hover:text-fg underline"
          >
            View in code browser
          </NuxtLink>
        </div>
      </div>

      <!-- No changes -->
      <div
        v-else-if="diff && diff.hunks.length === 0"
        class="py-8 text-center text-fg-muted text-sm"
      >
        No content changes detected
      </div>

      <!-- Diff content -->
      <DiffTable
        v-else-if="diff"
        :hunks="diff.hunks"
        :type="diff.type"
        :file-name="file.path"
        :enable-shiki="true"
        :word-wrap="wordWrap"
      />
    </div>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.slider-shell {
  position: relative;
  display: flex;
  align-items: center;
  height: 48px;
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  border-radius: 12px;
  overflow: hidden;
  cursor: grab;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    opacity 150ms ease;
}

.slider-shell:hover {
  background: var(--bg-muted);
  border-color: var(--border-hover);
}

.slider-shell:active {
  cursor: grabbing;
}

.slider-shell.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slider-labels {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  pointer-events: none;
  z-index: 3;
}

.slider-label {
  font-size: 0.875rem;
  font-weight: 400;
  color: color-mix(in srgb, var(--fg) 30%, transparent);
  letter-spacing: -0.01em;
  transition: color 150ms ease;
}

.slider-shell:hover .slider-label {
  color: var(--fg);
}

.slider-value {
  min-width: 32px;
  text-align: right;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg);
}

.slider-track {
  position: absolute;
  inset: 0;
  background: var(--bg-muted);
  border-radius: 10px;
  overflow: hidden;
  z-index: 1;
  pointer-events: none;
}

.slider-mark {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--fg) 20%, transparent);
  transform: translateY(-50%);
  pointer-events: none;
  opacity: 0.9;
}

.slider-range {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--bg-subtle);
  border-radius: 10px;
  transition:
    width 150ms ease-out,
    background-color 150ms ease-out;
  z-index: 2;
  pointer-events: none;
}

.slider-range::after {
  content: '';
  position: absolute;
  right: 8px;
  top: 50%;
  width: 2px;
  height: 28px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--fg) 20%, transparent);
  transform: translateY(-50%);
  transition: background-color 150ms ease;
}

.slider-shell:hover .slider-range::after {
  background: color-mix(in srgb, var(--fg) 50%, transparent);
}

.slider-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: inherit;
  -webkit-appearance: none;
  background: transparent;
  z-index: 4;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 32px;
  width: 16px;
}

.slider-input::-moz-range-thumb {
  height: 32px;
  width: 16px;
  border: none;
  background: transparent;
}
</style>
