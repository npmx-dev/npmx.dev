<script setup lang="ts">
const { packages, openCount } = useAddToCollection()

const subtitle = computed(() =>
  packages.value.length === 1
    ? packages.value[0]
    : $t(
        'collections.picker.packages',
        { count: $n(packages.value.length) },
        packages.value.length,
      ),
)
</script>

<template>
  <Modal
    :id="ADD_TO_COLLECTION_MODAL_ID"
    :modal-title="$t('collections.picker.title')"
    :modal-subtitle="subtitle"
    class="max-w-md"
  >
    <CollectionPicker v-if="packages.length" :key="openCount" :packages />
  </Modal>
</template>
