<script setup lang="ts">
import type { AtIdentifierString } from '@atproto/lex'
import { findNoodle } from '~/noodles'
import { resolveNoodleLogo } from '~/components/Noodle'

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const noodle = computed(() => findNoodle(slug.value))
const logo = computed(() => (noodle.value ? resolveNoodleLogo(noodle.value.key) : undefined))

const enrichedAuthors = computed(() =>
  (noodle.value?.authors ?? []).map(a => ({
    name: a.name,
    blueskyHandle: a.blueskyHandle as AtIdentifierString | undefined,
    profileUrl: a.blueskyHandle ? `https://bsky.app/profile/${a.blueskyHandle}` : null,
  })),
)

const { resolvedAuthors } = useBlueskyAuthorProfiles(enrichedAuthors.value)

useSeoMeta({
  title: () =>
    noodle.value
      ? `${noodle.value.title} — ${$t('noodles.title')}`
      : `${$t('noodles.missing.title')} — ${$t('noodles.title')}`,
  description: () => noodle.value?.occasion,
  ogTitle: () => noodle.value?.title,
  ogDescription: () => noodle.value?.occasion,
})

if (noodle.value) {
  defineOgImage(
    'Noodle.takumi',
    {
      title: noodle.value.title,
      occasion: noodle.value.occasion ?? '',
      poster: noodle.value.posterImage,
      backdrop: noodle.value.posterBackdrop ?? '',
    },
    { alt: `${noodle.value.title} — npmx` },
  )
} else {
  defineOgImage(
    'Page.takumi',
    {
      title: () => $t('noodles.missing.title'),
      description: () => $t('noodles.title'),
    },
    { alt: () => `${$t('noodles.missing.title')} — npmx` },
  )
}

onMounted(() => {
  if (!noodle.value) {
    const event = useRequestEvent()
    if (event) setResponseStatus(event, 404)
  }
})

if (import.meta.server && !noodle.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}
</script>

<template>
  <main class="w-full flex-1 flex flex-col">
    <section
      class="relative flex-1 flex flex-col pt-6 pb-10 sm:pt-8 sm:pb-16 lg:pb-20 px-4 sm:px-6"
    >
      <div
        class="absolute inset-0 [background-image:repeating-linear-gradient(115deg,rgb(0_0_0/0.04)_0_22px,transparent_22px_80px)] dark:[background-image:repeating-linear-gradient(115deg,rgb(0_0_0/0.35)_0_22px,transparent_22px_80px)]"
        aria-hidden="true"
      />

      <nav class="relative max-w-6xl w-full mx-auto mb-10 sm:mb-14 lg:mb-16 flex justify-end">
        <NuxtLink
          to="/noodles"
          class="inline-flex items-center gap-2 text-sm font-mono text-fg-muted hover:text-fg transition-colors"
        >
          <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
          {{ $t('noodles.back_to_archive') }}
        </NuxtLink>
      </nav>

      <div
        class="relative max-w-6xl w-full mx-auto grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-y-10 gap-x-16 xl:gap-x-24 items-start"
      >
        <!-- LENS COLUMN -->
        <NoodleLens :logo="logo" :variants="noodle?.variants" :title="noodle?.title" />

        <!-- CONTENT CARD -->
        <article
          class="rounded-2xl bg-bg-elevated/40 border border-border-subtle p-6 sm:p-10 backdrop-blur-sm"
        >
          <template v-if="noodle">
            <h1
              class="font-mono text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight mb-3 sm:mb-4 break-words"
            >
              {{ noodle.title }}
            </h1>
            <p v-if="noodle.occasion" class="text-fg-muted text-base sm:text-lg leading-relaxed">
              {{ noodle.occasion }}
            </p>

            <p
              v-if="noodle.description"
              class="text-fg-muted text-base leading-relaxed whitespace-pre-line mt-6 sm:mt-8"
            >
              {{ noodle.description }}
            </p>

            <hr class="border-0 border-t border-border-subtle my-8 sm:my-10" />

            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6 text-xs font-mono m-0">
              <div>
                <dt class="text-fg-subtle uppercase tracking-widest mb-1.5">
                  {{ $t('noodles.dates') }}
                </dt>
                <dd class="text-fg-muted">
                  <DateTime :datetime="noodle.date" year="numeric" month="short" day="numeric" />
                  <template v-if="noodle.dateTo">
                    <span class="text-fg-subtle mx-1">—</span>
                    <DateTime
                      :datetime="noodle.dateTo"
                      year="numeric"
                      month="short"
                      day="numeric"
                    />
                  </template>
                </dd>
              </div>
              <div v-if="noodle.prUrl">
                <dt class="text-fg-subtle uppercase tracking-widest mb-1.5">
                  {{ $t('noodles.shipped_in') }}
                </dt>
                <dd>
                  <LinkBase :to="noodle.prUrl" no-new-tab-icon class="text-fg-muted">
                    {{ noodle.prUrl.split('/').pop() ? `#${noodle.prUrl.split('/').pop()}` : 'PR' }}
                  </LinkBase>
                </dd>
              </div>
              <div v-if="resolvedAuthors.length" class="sm:col-span-2">
                <dt class="text-fg-subtle uppercase tracking-widest mb-3">
                  {{ $t('noodles.credits') }}
                </dt>
                <dd>
                  <AuthorList :authors="resolvedAuthors" variant="expanded" />
                </dd>
              </div>
              <div v-if="noodle.references?.length" class="sm:col-span-2">
                <dt class="text-fg-subtle uppercase tracking-widest mb-2">
                  {{ $t('noodles.learn_more') }}
                </dt>
                <dd>
                  <ul class="list-none p-0 m-0 flex flex-col gap-1.5">
                    <li v-for="(ref, idx) in noodle.references" :key="idx">
                      <LinkBase :to="ref.url" class="text-fg-muted">
                        {{ ref.label ?? ref.url }}
                      </LinkBase>
                    </li>
                  </ul>
                </dd>
              </div>
            </dl>
          </template>

          <template v-else>
            <p class="font-mono text-xs tracking-widest uppercase text-fg-subtle mb-3">
              404 — {{ $t('noodles.missing.empty_bowl') }}
            </p>
            <h1 class="font-mono text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              {{ $t('noodles.missing.title') }}
            </h1>
            <p class="text-fg-muted text-base sm:text-lg leading-relaxed">
              {{ $t('noodles.missing.body', { slug }) }}
            </p>
          </template>
        </article>
      </div>
    </section>
  </main>
</template>
