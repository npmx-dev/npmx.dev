<script setup lang="ts">
import type { OwnCollection } from '#shared/types/social'
import {
  MAX_COLLECTION_ITEMS,
  MAX_COLLECTION_NAME_LENGTH,
  PACKAGE_SUBJECT_REF,
} from '#shared/utils/constants'

const props = defineProps<{
  packages: string[]
}>()

const { collections, status, load, changeItems, create } = useOwnCollections()
const { user } = useAtproto()
// The session may still be loading when the picker mounts
watch(
  () => user.value?.did,
  () => load({ force: true }),
  { immediate: true },
)

const subjectRefs = computed(() => props.packages.map(PACKAGE_SUBJECT_REF))

function containedCount(collection: OwnCollection) {
  return subjectRefs.value.filter(ref => collection.subjectRefs.includes(ref)).length
}
const containsAll = (collection: OwnCollection) =>
  containedCount(collection) === subjectRefs.value.length
const containsSome = (collection: OwnCollection) =>
  containedCount(collection) > 0 && !containsAll(collection)
const isFull = (collection: OwnCollection) =>
  !containsAll(collection) &&
  collection.subjectRefs.length + subjectRefs.value.length - containedCount(collection) >
    MAX_COLLECTION_ITEMS

const pendingUris = ref(new Set<string>())
const failedUri = shallowRef<string | null>(null)

// Not disabled while pending: disabling the focused box would drop focus out of the dialog
async function toggle(collection: OwnCollection, event: Event) {
  const input = event.target as HTMLInputElement
  if (pendingUris.value.has(collection.uri)) return
  pendingUris.value.add(collection.uri)
  failedUri.value = null
  try {
    await changeItems(
      collection,
      containsAll(collection) ? { remove: subjectRefs.value } : { add: subjectRefs.value },
    )
  } catch {
    failedUri.value = collection.uri
    // The browser already flipped the box, and Vue won't re-patch an unchanged binding
    input.checked = containsAll(collection)
    input.indeterminate = containsSome(collection)
  } finally {
    pendingUris.value.delete(collection.uri)
  }
}

const { polite } = useAnnouncer()
const newName = shallowRef('')
const isCreating = shallowRef(false)
const createError = shallowRef('')

async function submitNew() {
  const name = newName.value.trim()
  if (!name || isCreating.value) return
  isCreating.value = true
  createError.value = ''
  try {
    await create(name, subjectRefs.value)
    newName.value = ''
    polite($t('collections.picker.created', { name }))
  } catch {
    createError.value = $t('collections.picker.create_error')
  } finally {
    isCreating.value = false
  }
}

const newNameId = useId()
const fullReasonId = useId()
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Also when a refresh fails, since the list shown may then be out of date -->
    <p v-if="status === 'error'" role="alert" class="text-sm text-fg-muted">
      {{ $t('collections.load_error') }}
    </p>
    <div v-if="!collections && status === 'pending'" class="flex flex-col gap-2">
      <SkeletonBlock v-for="i in 3" :key="i" class="h-10 rounded-lg" />
    </div>
    <p v-else-if="collections?.length === 0" class="text-sm text-fg-muted">
      {{ $t('collections.picker.none_yet') }}
    </p>
    <ul
      v-else-if="collections"
      class="m-0 flex max-h-80 list-none flex-col gap-1 overflow-y-auto p-0"
    >
      <li v-for="collection in collections" :key="collection.uri">
        <label
          class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-200"
          :class="isFull(collection) ? 'opacity-60 cursor-not-allowed' : 'hover:bg-bg-muted'"
        >
          <input
            type="checkbox"
            class="size-4 shrink-0 accent-fg"
            :checked="containsAll(collection)"
            :indeterminate="containsSome(collection)"
            :disabled="isFull(collection)"
            :aria-describedby="isFull(collection) ? fullReasonId : undefined"
            @change="toggle(collection, $event)"
          />
          <span class="min-w-0 flex-1 truncate font-mono text-sm">{{ collection.name }}</span>
          <TooltipApp
            v-if="isFull(collection)"
            :text="$t('collections.picker.full_reason', { max: $n(MAX_COLLECTION_ITEMS) })"
          >
            <span class="shrink-0 text-xs text-fg-subtle">{{ $t('collections.picker.full') }}</span>
          </TooltipApp>
          <span v-else class="shrink-0 text-xs text-fg-subtle">
            {{
              $t(
                'collections.item_count',
                { count: $n(collection.itemCount) },
                collection.itemCount,
              )
            }}
          </span>
        </label>
        <p
          v-if="failedUri === collection.uri"
          role="alert"
          class="px-3 font-mono text-xs text-red-700 dark:text-red-400"
        >
          {{ $t('collections.picker.save_error') }}
        </p>
      </li>
    </ul>
    <p :id="fullReasonId" class="sr-only">
      {{ $t('collections.picker.full_reason', { max: $n(MAX_COLLECTION_ITEMS) }) }}
    </p>

    <form class="flex flex-col gap-2 border-t border-border pt-4" @submit.prevent="submitNew">
      <label :for="newNameId" class="text-sm">{{ $t('collections.new') }}</label>
      <div class="flex gap-2">
        <InputBase
          :id="newNameId"
          v-model="newName"
          class="min-w-0 flex-1"
          :maxlength="MAX_COLLECTION_NAME_LENGTH"
          :no-correct="false"
          :placeholder="$t('collections.picker.name_placeholder')"
        />
        <ButtonBase type="submit" variant="primary" :disabled="isCreating || !newName.trim()">
          {{ $t('collections.picker.create') }}
        </ButtonBase>
      </div>
      <p v-if="createError" role="alert" class="font-mono text-sm text-red-700 dark:text-red-400">
        {{ createError }}
      </p>
    </form>
  </div>
</template>
