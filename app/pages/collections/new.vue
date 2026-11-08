<script setup lang="ts">
import type { CollectionView } from '#shared/types/social'
import {
  collectionPath,
  createCollection,
  ensureCollectionWriteAccess,
  parseCollectionQuery,
  type CollectionBody,
} from '~/utils/atproto/collections'

const route = useRoute('collections-new')
const { user, pending: userPending } = useAtproto()
const authModal = useModal('auth-modal')

// `?from=<did or handle>/<rkey>` duplicates an existing collection
const from = computed(() => parseCollectionQuery(route.query.from))
const { data: source } = await useAsyncData(
  () => `collection-source:${from.value?.identifier}/${from.value?.rkey}`,
  () =>
    from.value
      ? $fetch<CollectionView>(collectionPath(from.value.identifier, from.value.rkey)).catch(
          () => null,
        )
      : Promise.resolve(null),
)

onMounted(() => {
  watch(
    () => user.value?.handle,
    handle => handle && ensureCollectionWriteAccess(handle, route.fullPath),
    { immediate: true },
  )
})

const isSaving = shallowRef(false)
const saveError = shallowRef('')

async function save(body: CollectionBody) {
  isSaving.value = true
  saveError.value = ''
  let created
  try {
    created = await createCollection(body, user.value?.handle)
  } catch {
    saveError.value = $t('collections.editor.save_error')
    return
  } finally {
    isSaving.value = false
  }
  await navigateTo({
    name: 'collections-identifier-rkey',
    params: { identifier: user.value?.handle ?? created.did, rkey: created.rkey },
  })
}

const router = useRouter()
const canGoBack = useCanGoBack()
function cancel() {
  if (canGoBack.value) router.back()
  else navigateTo('/')
}

useSeoMeta({
  title: () => $t('collections.new_title'),
  ogTitle: () => $t('collections.new_title'),
  twitterTitle: () => $t('collections.new_title'),
})
</script>

<template>
  <main class="container flex-1 flex flex-col gap-8 py-12 sm:py-16 w-full max-w-3xl">
    <h1 class="font-mono text-3xl sm:text-4xl font-medium">{{ $t('collections.new') }}</h1>

    <div v-if="userPending" class="flex flex-col gap-4">
      <SkeletonBlock v-for="i in 3" :key="i" class="h-12 rounded-lg" />
    </div>
    <div
      v-else-if="!user?.handle"
      class="flex flex-col items-start gap-4 rounded-lg border border-border bg-bg-subtle p-6"
    >
      <p>{{ $t('collections.sign_in_to_create') }}</p>
      <ButtonBase variant="primary" @click="authModal.open()">
        {{ $t('auth.modal.connect') }}
      </ButtonBase>
    </div>
    <CollectionEditor
      v-else
      :key="source?.uri ?? 'new'"
      :initial="source ?? undefined"
      :pending="isSaving"
      :error-message="saveError"
      @submit="save"
      @cancel="cancel"
    />
  </main>
</template>
