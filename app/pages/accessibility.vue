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
            :title="$t('nav.back')"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
          >
            <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
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

        <!-- Commitment to Accessibility -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.commitment.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('a11y.commitment.p1') }}
          </p>
        </div>

        <!-- Regulatory Framework and Compliance Status -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.compliance.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="a11y.compliance.p1" tag="span" scope="global">
              <template #guidelines>
                <strong class="text-fg">{{ $t('a11y.compliance.guidelines') }}</strong>
              </template>
              <template #aa>
                <strong class="text-fg">{{ $t('a11y.compliance.aa') }}</strong>
              </template>
            </i18n-t>
          </p>
          <a
            :title="$t('a11y.compliance.wcag_alt')"
            href="https://www.w3.org/WAI/WCAG2AA-Conformance"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
          >
            <img
              src="/wcag2.1AA.svg"
              width="88"
              height="32"
              :alt="$t('a11y.compliance.wcag_alt')"
            />
          </a>
        </div>

        <!-- Implementation Measures -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('a11y.implementation.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('a11y.implementation.p1') }}
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0 mb-4">
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li1') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li2') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li3') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li4') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li5') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li6') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span aria-hidden="true" class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('a11y.implementation.li7') }}</span>
            </li>
          </ul>
        </div>

        <!-- Contact and Feedback -->
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
                  <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true" />
                </a>
              </template>
            </i18n-t>
          </p>
        </div>
      </section>
    </article>
  </main>
</template>
