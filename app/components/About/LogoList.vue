<script setup lang="ts">
type BaseItem = {
  name: string
  url: string
  normalisingIndent?: string
  logo:
    | string
    | {
        dark: string
        light: string
      }
}

type GroupItem = {
  name: string
  items: BaseItem[]
}

const props = defineProps<{
  list: (BaseItem | GroupItem)[]
}>()
</script>

<template>
  <ul class="flex flex-wrap gap-4 md:gap-x-6 md:gap-y-4 list-none">
    <li v-for="item in list" :key="item.name">
      <a
        v-if="'logo' in item"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        class="relative flex items-center justify-center h-14 min-w-14 rounded-md hover:bg-fg/10 transition-colors p-1"
        :style="{ paddingBlock: item.normalisingIndent }"
        :aria-label="item.name"
      >
        <AboutLogoImg :src="item.logo" :alt="item.name" />
      </a>
      <div v-else-if="item.items" class="relative flex items-center justify-center">
        <svg
          width="11"
          height="38"
          viewBox="0 0 11 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.62151 0C-1.8519 10.6931 -1.89574 27.2683 5.62151 37.9997H10.6709C3.15538 27.2683 3.19922 10.6931 10.6709 0H5.62151Z"
            fill="currentColor"
          />
        </svg>
        <ul class="flex items-center justify-center h-full gap-0.5 list-none">
          <li v-for="groupItem in item.items" :key="groupItem.name">
            <a
              :href="groupItem.url"
              target="_blank"
              rel="noopener noreferrer"
              class="relative flex items-center justify-center h-10 min-w-10 rounded-md hover:bg-fg/10 transition-colors p-0.5"
              :style="{ paddingBlock: groupItem.normalisingIndent }"
              :aria-label="groupItem.name"
            >
              <AboutLogoImg :src="groupItem.logo" :alt="groupItem.name" />
            </a>
          </li>
        </ul>
        <svg
          width="11"
          height="38"
          viewBox="0 0 11 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5.04935 0H0C7.4734 10.6931 7.51725 27.2683 0 37.9997H5.04935C12.5648 27.2683 12.521 10.6931 5.04935 0Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </li>
  </ul>
</template>
