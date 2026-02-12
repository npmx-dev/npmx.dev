<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import { normalizeSearchParam } from '#shared/utils/url'

const route = useRoute('/profile/[handle]')
const router = useRouter()

type LikesResult = {
  records: {
    value: {
      subjectRef: string
    }
  }[]
}

const handle = computed(() => route.params.handle)

const { data: profile }: { data?: NPMXProfile } = useFetch(
  () => `/api/social/profile/${handle.value}`,
  {
    default: () => ({ profile: { displayName: handle.value } }),
    server: false,
  },
)

const { data: likesData, status } = await useProfileLikes(handle)

useSeoMeta({
  title: () => `${handle.value} - npmx`,
  description: () => `npmx profile by ${handle.value}`,
})

/**
defineOgImageComponent('Default', {
  title: () => `~${username.value}`,
  description: () => (results.value ? `${results.value.total} packages` : 'npm user profile'),
  primaryColor: '#60a5fa',
})
**/
</script>

<template>
  <main class="container flex-1 flex flex-col py-8 sm:py-12 w-full">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-col flex-wrap gap-4">
        <h1 class="font-mono text-2xl sm:text-3xl font-medium">{{ profile.displayName }}</h1>
        <p v-if="profile.description">{{ profile.description }}</p>
        <div class="flex gap-4">
          <h2>@{{ handle }}</h2>
          <a
            v-if="profile.website"
            :href="profile.website"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
          >
            <span class="i-carbon:link w-4 h-4" aria-hidden="true" />
            {{ profile.website }}
          </a>
        </div>
      </div>
    </header>

    <section class="flex flex-col gap-8">
      <h2
        class="font-mono text-2xl sm:text-3xl font-medium min-w-0 break-words"
        :title="Likes"
        dir="ltr"
      >
        Likes <span v-if="likesData">({{ likesData.likes.records.length ?? 0 }})</span>
      </h2>
      <div v-if="status === 'pending'">
        <p>Loading...</p>
      </div>
      <div v-else-if="status === 'error'">
        <p>Error</p>
      </div>
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PackageLikeCard
          v-if="likesData.likes.records"
          v-for="like in likesData.likes.records"
          :packageUrl="like.value.subjectRef"
        />
      </div>
    </section>
  </main>
</template>
