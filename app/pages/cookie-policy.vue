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

const router = useRouter()
const buildInfo = useAppConfig().buildInfo
const { locale } = useI18n()
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 w-full overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('cookie_policy.title') }}
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
        <i18n-t
          keypath="cookie_policy.last_updated"
          tag="p"
          scope="global"
          class="text-fg-muted text-lg"
        >
          <template #date>
            <NuxtTime
              :locale
              :datetime="buildInfo.cookiePolicyDate"
              date-style="long"
              time-style="medium"
            />
          </template>
        </i18n-t>
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
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
            {{ $t('cookie_policy.section_1.title') }}
          </h2>
          <p>{{ $t('cookie_policy.section_1.p1') }}</p>
        </section>

        <section class="mt-8">
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
            {{ $t('cookie_policy.section_2.title') }}
          </h2>
          <p class="mb-4">
            <i18n-t keypath="cookie_policy.section_2.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('cookie_policy.section_2.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <ul class="list-none ps-5 space-y-2">
            <li class="flex justify-start items-start gap-2">
              <span aria-hidden="true" class="text-fg-subtle shrink-0">—</span>
              <i18n-t keypath="cookie_policy.section_2.li1" tag="span">
                <template #li11>
                  <strong class="text-fg font-mono text-sm">
                    <bdi>{{ $t('cookie_policy.section_2.cookie_vdpl') }}</bdi>
                  </strong>
                </template>
                <template #separator>
                  <bdi>{{ $t('cookie_policy.section_2.separator') }}</bdi>
                </template>
                <template #li12>
                  <bdi>{{ $t('cookie_policy.section_2.cookie_vdpl_desc') }}</bdi>
                </template>
              </i18n-t>
            </li>
            <li class="flex justify-start items-start gap-2">
              <span aria-hidden="true" class="text-fg-subtle shrink-0">—</span>
              <i18n-t keypath="cookie_policy.section_2.li2" tag="span">
                <template #li21>
                  <strong class="text-fg font-mono text-sm">
                    <bdi>{{ $t('cookie_policy.section_2.cookie_h3') }}</bdi>
                  </strong>
                </template>
                <template #separator>
                  <bdi>{{ $t('cookie_policy.section_2.separator') }}</bdi>
                </template>
                <template #li22>
                  <bdi>{{ $t('cookie_policy.section_2.cookie_h3_desc') }}</bdi>
                </template>
              </i18n-t>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
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
                  class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('cookie_policy.section_3.settings') }}
                </NuxtLink>
              </template>
            </i18n-t>
          </p>
          <p>
            <i18n-t keypath="cookie_policy.section_3.p2" tag="span" scope="global">
              <template #bold2>
                <strong class="text-fg">{{ $t('cookie_policy.section_3.bold2') }}</strong>
              </template>
            </i18n-t>
          </p>
        </section>

        <section class="mt-8">
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
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
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
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
                class="flex justify-start items-center gap-2 p-3"
              >
                <span aria-hidden="true" class="text-fg-subtle shrink-0">—</span>
                <span class="flex justify-between items-center flex-grow-1">
                  <span
                    class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                  >
                    {{ $t('cookie_policy.section_5.chrome') }}
                  </span>
                  <span class="i-carbon:launch rtl-flip w-5 h-5" aria-hidden="true"></span>
                </span>
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox"
                target="_blank"
                rel="noopener noreferrer"
                class="flex justify-start items-center gap-2 p-3"
              >
                <span aria-hidden="true" class="text-fg-subtle shrink-0">—</span>
                <span class="flex justify-between items-center flex-grow-1">
                  <span
                    class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                  >
                    {{ $t('cookie_policy.section_5.firefox') }}
                  </span>
                  <span class="i-carbon:launch rtl-flip w-5 h-5" aria-hidden="true"></span>
                </span>
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d"
                target="_blank"
                rel="noopener noreferrer"
                class="flex justify-start items-center gap-2 p-3"
              >
                <span aria-hidden="true" class="text-fg-subtle shrink-0">—</span>
                <span class="flex justify-between items-center flex-grow-1">
                  <span
                    class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                  >
                    {{ $t('cookie_policy.section_5.edge') }}
                  </span>
                  <span class="i-carbon:launch rtl-flip w-5 h-5" aria-hidden="true"></span>
                </span>
              </a>
            </li>
          </ul>
        </section>

        <section class="mt-8">
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
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
                  <span
                    class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                    >{{ $t('cookie_policy.section_6.link') }}</span
                  >
                  <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true"></span>
                </a>
              </template>
            </i18n-t>
          </p>
        </section>

        <section class="mt-8">
          <h2 class="text-lg text-fg-subtle tracking-wider mb-4 uppercase">
            {{ $t('cookie_policy.section_7.title') }}
          </h2>
          <p>{{ $t('cookie_policy.section_7.p1') }}</p>
        </section>
      </div>
    </article>
  </main>
</template>
