<script setup lang="ts">
import * as v from 'valibot'
import { CollectionBodySchema } from '#shared/schemas/social'
import {
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_COLLECTION_ITEMS,
  MAX_COLLECTION_NAME_LENGTH,
  MAX_COLLECTION_NOTE_LENGTH,
  PACKAGE_SUBJECT_REF,
} from '#shared/utils/constants'
import { parseSubjectRef } from '#shared/utils/collections'
import { resolveSubjectRefInput, type CollectionBody } from '~/utils/atproto/collections'
import type { CollectionItemView, CollectionView } from '#shared/types/social'

const props = defineProps<{
  /** The collection being edited or duplicated */
  initial?: Pick<CollectionView, 'name' | 'description' | 'items'>
  pending?: boolean
  /** Shown above the actions, e.g. a save or conflict error */
  errorMessage?: string
}>()

const emit = defineEmits<{
  submit: [body: CollectionBody]
  cancel: []
}>()

type NewItem = { subjectRef: string; note?: string }

function labelFor(item: CollectionItemView | NewItem) {
  if ('collection' in item && item.collection) return item.collection.name
  const subject = parseSubjectRef(item.subjectRef)
  return subject?.kind === 'package' ? subject.packageName : item.subjectRef
}

let nextKey = 0
const toItem = (item: CollectionItemView | NewItem) => ({
  subjectRef: item.subjectRef,
  note: item.note,
  label: labelFor(item),
  key: nextKey++,
})
const name = shallowRef(props.initial?.name ?? '')
const description = shallowRef(props.initial?.description ?? '')
const items = ref((props.initial?.items ?? []).map(toItem))

const newItemInput = shallowRef('')
const addError = shallowRef('')
const isResolving = shallowRef(false)
const isFull = computed(() => items.value.length >= MAX_COLLECTION_ITEMS)
const addHintId = useId()
const addErrorId = useId()

const packageNamesInCollection = computed(() =>
  items.value.flatMap(item => {
    const subject = parseSubjectRef(item.subjectRef)
    return subject?.kind === 'package' ? [subject.packageName] : []
  }),
)

function pushItem(subjectRef: string) {
  if (isFull.value) return
  if (!items.value.some(item => item.subjectRef === subjectRef)) {
    items.value.push(toItem({ subjectRef }))
  }
  newItemInput.value = ''
  addError.value = ''
}

function addPackage(packageName: string) {
  pushItem(PACKAGE_SUBJECT_REF(packageName))
}

// Free text only counts if it's an exact package match or a link, so typos don't become items.
async function addFromText(text: string, exactMatch: boolean) {
  addError.value = ''
  if (exactMatch) {
    addPackage(text)
    return
  }
  if (isResolving.value || !/^(?:at|https?):\/\//.test(text)) {
    addError.value = $t('collections.editor.invalid_item')
    return
  }
  isResolving.value = true
  try {
    const subjectRef = await resolveSubjectRefInput(text)
    if (!subjectRef || !parseSubjectRef(subjectRef)) {
      addError.value = $t('collections.editor.invalid_item')
      return
    }
    pushItem(subjectRef)
  } finally {
    isResolving.value = false
  }
}

const { polite } = useAnnouncer()
const listRef = useTemplateRef('list')
const nameInput = useTemplateRef('nameInput')
const itemControl = (key: number, action: string) =>
  listRef.value?.querySelector<HTMLElement>(
    `[data-item-key="${key}"] [data-action="${action}"]:not(:disabled)`,
  )

// Reordering re-renders the row and removing deletes it, either of which drops focus to <body>
async function move(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= items.value.length) return
  const [item] = items.value.splice(index, 1)
  items.value.splice(target, 0, item!)
  polite(
    $t('collections.editor.moved', {
      name: item!.label,
      position: $n(target + 1),
      total: $n(items.value.length),
    }),
  )
  await nextTick()
  // At either end the pressed arrow is now disabled, so fall back to the other one
  ;(
    itemControl(item!.key, offset < 0 ? 'up' : 'down') ??
    itemControl(item!.key, offset < 0 ? 'down' : 'up')
  )?.focus()
}

async function remove(index: number) {
  const [item] = items.value.splice(index, 1)
  polite($t('collections.editor.removed', { name: item!.label }))
  await nextTick()
  const next = items.value[index] ?? items.value[index - 1]
  ;(next
    ? itemControl(next.key, 'remove')
    : document.getElementById('collection-add-item')
  )?.focus()
}

const body = computed<CollectionBody>(() => ({
  name: name.value,
  description: description.value || undefined,
  items: items.value.map(({ subjectRef, note }) => ({ subjectRef, note: note || undefined })),
}))
// Records from other apps can hold things we won't write back, so say what to fix rather than
// leaving Save mysteriously disabled.
const invalidReason = computed(() => {
  if (v.is(CollectionBodySchema, body.value)) return ''
  if (!name.value.trim()) return $t('collections.editor.name_required')
  if (items.value.some(item => !parseSubjectRef(item.subjectRef))) {
    return $t('collections.editor.unrecognized_items')
  }
  const excess = items.value.length - MAX_COLLECTION_ITEMS
  if (excess > 0) {
    return $t(
      'collections.editor.too_many_items',
      { count: $n(excess), max: $n(MAX_COLLECTION_ITEMS) },
      excess,
    )
  }
  return $t('collections.editor.too_long', {
    name: $n(MAX_COLLECTION_NAME_LENGTH),
    description: $n(MAX_COLLECTION_DESCRIPTION_LENGTH),
    note: $n(MAX_COLLECTION_NOTE_LENGTH),
  })
})
// Only after a save attempt, so a blank new form doesn't open with an error
const showInvalidReason = shallowRef(false)

function submit() {
  if (props.pending) return
  if (invalidReason.value) {
    // An alert that's already showing isn't read out again
    if (showInvalidReason.value) polite(invalidReason.value)
    showInvalidReason.value = true
    return
  }
  emit('submit', body.value)
}

defineExpose({ focus: () => nameInput.value?.focus() })
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <p class="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-4 text-sm">
      <span class="i-lucide:globe mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ $t('collections.editor.public_notice') }}
    </p>

    <label class="flex flex-col gap-2 text-sm">
      {{ $t('collections.editor.name') }}
      <InputBase
        ref="nameInput"
        v-model="name"
        required
        :maxlength="MAX_COLLECTION_NAME_LENGTH"
        :no-correct="false"
      />
    </label>

    <label class="flex flex-col gap-2 text-sm">
      {{ $t('collections.editor.description') }}
      <InputBase
        v-model="description"
        :maxlength="MAX_COLLECTION_DESCRIPTION_LENGTH"
        :no-correct="false"
      />
    </label>

    <fieldset class="flex flex-col gap-3 border-0 p-0 m-0">
      <legend class="mb-3 text-sm">
        {{ $t('collections.editor.items') }}
        <span class="text-fg-subtle">
          ({{ $t('collections.editor.item_limit', { max: $n(MAX_COLLECTION_ITEMS) }) }})
        </span>
      </legend>

      <ol v-if="items.length > 0" ref="list" class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="(item, index) in items"
          :key="item.key"
          :data-item-key="item.key"
          class="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle p-3"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-mono text-sm truncate min-w-0 flex-1" :title="item.subjectRef">
              {{ item.label }}
            </span>
            <span
              v-if="!parseSubjectRef(item.subjectRef)"
              class="font-mono text-xs text-red-700 dark:text-red-400 shrink-0"
            >
              {{ $t('collections.editor.unrecognized') }}
            </span>
            <ButtonBase
              classicon="i-lucide:arrow-up"
              data-action="up"
              :disabled="index === 0"
              :aria-label="$t('collections.editor.move_up', { name: item.label })"
              @click="move(index, -1)"
            />
            <ButtonBase
              classicon="i-lucide:arrow-down"
              data-action="down"
              :disabled="index === items.length - 1"
              :aria-label="$t('collections.editor.move_down', { name: item.label })"
              @click="move(index, 1)"
            />
            <ButtonBase
              classicon="i-lucide:x"
              data-action="remove"
              :aria-label="$t('collections.editor.remove', { name: item.label })"
              @click="remove(index)"
            />
          </div>
          <InputBase
            v-model="item.note"
            size="sm"
            :maxlength="MAX_COLLECTION_NOTE_LENGTH"
            :no-correct="false"
            :placeholder="$t('collections.editor.note_placeholder')"
            :aria-label="$t('collections.editor.note_for', { name: item.label })"
          />
        </li>
      </ol>

      <div v-if="!isFull" class="flex flex-col gap-2">
        <PackageTypeahead
          v-model:query="newItemInput"
          input-id="collection-add-item"
          :label="$t('collections.editor.add_item_label')"
          :placeholder="$t('collections.editor.add_item_placeholder')"
          :describedby="addError ? `${addHintId} ${addErrorId}` : addHintId"
          :exclude="packageNamesInCollection"
          @select="addPackage"
          @submit="addFromText"
        />
        <p :id="addHintId" class="text-xs text-fg-subtle">
          {{ $t('collections.editor.add_item_hint') }}
        </p>
        <p
          v-if="addError"
          :id="addErrorId"
          role="alert"
          class="font-mono text-sm text-red-700 dark:text-red-400"
        >
          {{ addError }}
        </p>
      </div>
    </fieldset>

    <Alert v-if="showInvalidReason && invalidReason" variant="error">{{ invalidReason }}</Alert>
    <Alert v-if="errorMessage" variant="error">{{ errorMessage }}</Alert>

    <div class="flex gap-3">
      <!-- aria-disabled, not disabled: disabling the focused button would drop focus to <body> -->
      <ButtonBase
        type="submit"
        variant="primary"
        :aria-disabled="pending || undefined"
        :class="{ 'opacity-40 cursor-not-allowed': pending }"
      >
        {{ $t('common.save') }}
      </ButtonBase>
      <ButtonBase @click="emit('cancel')">{{ $t('common.cancel') }}</ButtonBase>
    </div>
  </form>
</template>
