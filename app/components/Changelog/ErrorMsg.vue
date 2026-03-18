<script setup lang="ts">
const { pkgName, changelogLink, viewOnGit } = defineProps<{
  pkgName?: string
  changelogLink: string
  viewOnGit: string
}>()
</script>
<template>
  <div class="w-full flex items-center flex-col gap-2 mt-4">
    <p>{{ $t('changelog.error.p1', { package: pkgName }) }}</p>
    <i18n-t keypath="changelog.error.p2" tag="p" #viewon>
      <LinkBase :to="changelogLink" class="lowercase">{{ viewOnGit }}</LinkBase>
    </i18n-t>
  </div>
</template>
