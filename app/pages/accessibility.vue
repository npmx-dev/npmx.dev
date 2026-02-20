<script setup lang="ts">
definePageMeta({
  name: 'accessibility',
})

useSeoMeta({
  title: () => `${$t('a11y.title')} - npmx`,
  description: () => $t('a11y.welcome', { app: 'npmx' }),
})

defineOgImageComponent('Default', {
  title: () => $t('a11y.title'),
  description: () => $t('a11y.welcome', { app: 'npmx' }),
})

const router = useRouter()
const canGoBack = useCanGoBack()
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('a11y.title') }}
          </h1>
          <button
            type="button"
            class="cursor-pointer inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
          </button>
        </div>
      </header>

      <section class="prose prose-invert max-w-none space-y-8">
        <p class="text-fg-muted leading-relaxed">
          <i18n-t keypath="a11y.welcome" tag="span" scope="global">
            <template #app>
              <strong class="text-fg">npmx</strong>
            </template>
          </i18n-t>
        </p>

        <!-- Our Approach -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.approach.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('a11y.approach.p1') }}
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="a11y.approach.p2" tag="span" scope="global">
              <template #about>
                <NuxtLink
                  :to="{ name: 'about' }"
                  class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('a11y.approach.about_link') }}
                </NuxtLink>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- What We Do -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.measures.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('a11y.measures.p1') }}
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li1') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li2') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li3') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li4') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li5') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0">&mdash;</span>
              <span>{{ $t('a11y.measures.li6') }}</span>
            </li>
          </ul>
        </div>

        <!-- Known Limitations -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.limitations.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('a11y.limitations.p1') }}
          </p>
        </div>

        <!-- Feedback -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.contact.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="a11y.contact.p1" tag="span" scope="global">
              <template #app>
                <strong class="text-fg">npmx</strong>
              </template>
              <template #link>
                <a
                  href="https://github.com/npmx-dev/npmx.dev/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('a11y.contact.link') }}
                  <span class="i-lucide:external-link rtl-flip w-4 h-4" aria-hidden="true" />
                </a>
              </template>
            </i18n-t>
          </p>
        </div>
      </section>
    </article>
  </main>
</template>
