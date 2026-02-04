<script setup lang="ts">
definePageMeta({
  name: 'cookie-policy',
})

useSeoMeta({
  title: () => `${$t('cookie_policy.title')} - npmx`,
  description: () => $t('cookie_policy.welcome', { app: 'npmx' }),
})

defineOgImageComponent('Default', {
  title: () => $t('cookie_policy.title'),
  description: () => $t('cookie_policy.welcome', { app: 'npmx' }),
})
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 w-full">
    <article class="max-w-3xl mx-auto">
      <header class="mb-8 pb-8 border-b border-border">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium mb-4 lowercase">
          {{ $t('cookie_policy.title') }}
        </h1>
        <p class="text-fg-muted">
          {{
            $t('cookie_policy.last_updated', {
              date: '', // Placeholder, NuxtTime handles the date
            })
          }}
          <NuxtTime :datetime="new Date('2025-07-03')" date-style="long" />
        </p>
      </header>

      <div class="prose prose-invert max-w-none text-fg-muted">
        <p>
          <i18n-t keypath="cookie_policy.welcome" tag="span" scope="global">
            <template #app>
              <strong class="text-fg">npmx</strong>
            </template>
          </i18n-t>
        </p>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_1.title') }}
          </h2>
          <p>{{ $t('cookie_policy.section_1.p1') }}</p>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_2.title') }}
          </h2>
          <p class="mb-4">
            <i18n-t keypath="cookie_policy.section_2.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_2.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <ul class="list-disc ps-5 space-y-2">
            <li>
              <i18n-t keypath="cookie_policy.section_2.li1" tag="span" scope="global">
                <template #bold>
                  <strong class="text-fg">{{ $t('cookie_policy.section_2.li1_bold') }}</strong>
                </template>
              </i18n-t>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_3.title') }}
          </h2>
          <p class="mb-4">
            <i18n-t keypath="cookie_policy.section_3.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_3.bold') }}</strong>
              </template>
              <template #settings>
                <NuxtLink
                  to="/settings"
                  class="link-subtle font-mono text-xs min-h-11 inline-flex items-center gap-1 lowercase"
                >
                  {{ $t('cookie_policy.section_3.settings') }}
                </NuxtLink>
              </template>
            </i18n-t>
          </p>
          <p>
            <i18n-t keypath="cookie_policy.section_3.p2" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_3.bold2') }}</strong>
              </template>
            </i18n-t>
          </p>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_4.title') }}
          </h2>
          <p>
            <i18n-t keypath="cookie_policy.section_4.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_4.bold') }}</strong>
              </template>
              <template #bold2>
                <strong class="text-fg">{{ $t('cookie_policy.section_4.bold2') }}</strong>
              </template>
            </i18n-t>
          </p>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_5.title') }}
          </h2>
          <p class="mb-4">
            <i18n-t keypath="cookie_policy.section_5.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_5.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="mb-2">{{ $t('cookie_policy.section_5.p2') }}</p>
          <ul class="list-none px-0 space-y-2">
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                class="flex justify-between items-center gap-1 p-3"
              >
                {{ $t('cookie_policy.section_5.chrome') }}
                <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true"></span>
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox"
                target="_blank"
                rel="noopener noreferrer"
                class="flex justify-between items-center gap-1 p-3"
              >
                {{ $t('cookie_policy.section_5.firefox') }}
                <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true"></span>
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d"
                target="_blank"
                rel="noopener noreferrer"
                class="flex justify-between items-center gap-1 p-3"
              >
                {{ $t('cookie_policy.section_5.edge') }}
                <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true"></span>
              </a>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_6.title') }}
          </h2>
          <p>
            <i18n-t keypath="cookie_policy.section_6.p1" tag="span" scope="global">
              <template #link>
                <a
                  href="https://github.com/npmx-dev/npmx.dev/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1"
                >
                  <span>{{ $t('cookie_policy.section_6.link') }}</span>
                  <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true"></span>
                </a>
              </template>
            </i18n-t>
          </p>
        </section>

        <section class="mt-8">
          <h2 class="text-xl font-medium text-fg mb-4">
            {{ $t('cookie_policy.section_7.title') }}
          </h2>
          <p>{{ $t('cookie_policy.section_7.p1') }}</p>
        </section>
      </div>
    </article>
  </main>
</template>
