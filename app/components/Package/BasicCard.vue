<script setup lang="ts">
const props = defineProps<{
  packageName: string
}>()

function extractPackageFromRef(ref: string) {
  const { pkg } = /https:\/\/npmx.dev\/package\/(?<pkg>.*)/.exec(ref).groups
  const [org, name] = pkg.startsWith('@') ? pkg.split('/') : [null, pkg]
  return { full: pkg, org, name }
}

const orgName = computed(() => extractPackageFromRef(props.packageName))
</script>

<template>
  <NuxtLink :to="packageRoute(orgName.full)">
    <BaseCard class="group font-mono flex justify-between">
      {{ orgName.full }}
      <p class="transition-transform duration-150 group-hover:rotate-45">↗</p>
    </BaseCard>
  </NuxtLink>
</template>
