<script setup lang="ts">
definePageMeta({
  name: 'privacy',
})

useSeoMeta({
  title: () => `${$t('privacy_policy.title')} - npmx`,
  description: () => $t('privacy_policy.welcome', { app: 'npmx' }),
})

defineOgImageComponent('Default', {
  title: () => $t('privacy_policy.title'),
  description: () => $t('privacy_policy.welcome', { app: 'npmx' }),
})

const router = useRouter()
const buildInfo = useAppConfig().buildInfo
const { locale } = useI18n()
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('privacy_policy.title') }}
          </h1>
          <button
            type="button"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-show="router.options.history.state.back !== null"
          >
            <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <i18n-t
          keypath="privacy_policy.last_updated"
          tag="p"
          scope="global"
          class="text-fg-muted text-lg"
        >
          <template #date>
            <NuxtTime
              :locale
              :datetime="buildInfo.privacyPolicyDate"
              date-style="long"
              time-style="medium"
            />
          </template>
        </i18n-t>
      </header>

      <section class="prose prose-invert max-w-none space-y-8">
        <p class="text-fg-muted leading-relaxed">
          <i18n-t keypath="privacy_policy.welcome" tag="span" scope="global">
            <template #app>
              <strong class="text-fg">npmx</strong>
            </template>
          </i18n-t>
        </p>

        <!-- What are cookies -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.cookies.what_are.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('privacy_policy.cookies.what_are.p1') }}
          </p>
        </div>

        <!-- What cookies do we use -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.cookies.types.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="privacy_policy.cookies.types.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('privacy_policy.cookies.types.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <i18n-t keypath="privacy_policy.cookies.types.li1" tag="span">
                  <template #li11>
                    <strong class="text-fg font-mono text-sm">
                      <bdi>{{ $t('privacy_policy.cookies.types.cookie_vdpl') }}</bdi>
                    </strong>
                  </template>
                  <template #separator>
                    <bdi>{{ $t('privacy_policy.cookies.types.separator') }}</bdi>
                  </template>
                  <template #li12>
                    <bdi>{{ $t('privacy_policy.cookies.types.cookie_vdpl_desc') }}</bdi>
                  </template>
                </i18n-t>
              </span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>
                <i18n-t keypath="privacy_policy.cookies.types.li2" tag="span">
                  <template #li21>
                    <strong class="text-fg font-mono text-sm">
                      <bdi>{{ $t('privacy_policy.cookies.types.cookie_h3') }}</bdi>
                    </strong>
                  </template>
                  <template #separator>
                    <bdi>{{ $t('privacy_policy.cookies.types.separator') }}</bdi>
                  </template>
                  <template #li22>
                    <bdi>{{ $t('privacy_policy.cookies.types.cookie_h3_desc') }}</bdi>
                  </template>
                </i18n-t>
              </span>
            </li>
          </ul>
        </div>

        <!-- Local storage -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.cookies.local_storage.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="privacy_policy.cookies.local_storage.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{
                  $t('privacy_policy.cookies.local_storage.bold')
                }}</strong>
              </template>
              <template #settings>
                <NuxtLink
                  :to="{ name: 'settings' }"
                  class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('privacy_policy.cookies.local_storage.settings') }}
                </NuxtLink>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="privacy_policy.cookies.local_storage.p2" tag="span" scope="global">
              <template #bold2>
                <strong class="text-fg">{{
                  $t('privacy_policy.cookies.local_storage.bold2')
                }}</strong>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- Managing cookies -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.cookies.management.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="privacy_policy.cookies.management.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('privacy_policy.cookies.management.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('privacy_policy.cookies.management.p2') }}
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <a
                href="https://support.google.com/chrome/answer/95647?hl=en"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
              >
                {{ $t('privacy_policy.cookies.management.chrome') }}
                <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true" />
              </a>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <a
                href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
              >
                {{ $t('privacy_policy.cookies.management.firefox') }}
                <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true" />
              </a>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <a
                href="https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
              >
                {{ $t('privacy_policy.cookies.management.edge') }}
                <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>

        <!-- Analytics -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.analytics.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="privacy_policy.analytics.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('privacy_policy.analytics.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('privacy_policy.analytics.p2') }}
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0 mb-4">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.analytics.li1') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.analytics.li2') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.analytics.li3') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.analytics.li4') }}</span>
            </li>
          </ul>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('privacy_policy.analytics.p3') }}
          </p>
        </div>

        <!-- Authenticated Users -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.authenticated.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            <i18n-t keypath="privacy_policy.authenticated.p1" tag="span" scope="global">
              <template #bold>
                <strong class="text-fg">{{ $t('privacy_policy.authenticated.bold') }}</strong>
              </template>
            </i18n-t>
          </p>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="privacy_policy.authenticated.p2" tag="span" scope="global">
              <template #settings>
                <NuxtLink
                  :to="{ name: 'settings' }"
                  class="text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('privacy_policy.authenticated.settings') }}
                </NuxtLink>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- Data Retention -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.data_retention.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('privacy_policy.data_retention.p1') }}
          </p>
        </div>

        <!-- Your Rights -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.your_rights.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-4">
            {{ $t('privacy_policy.your_rights.p1') }}
          </p>
          <ul class="space-y-3 text-fg-muted list-none p-0 mb-4">
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.your_rights.li1') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.your_rights.li2') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.your_rights.li3') }}</span>
            </li>
            <li class="flex items-start gap-3">
              <span class="text-fg-subtle shrink-0 mt-1">&mdash;</span>
              <span>{{ $t('privacy_policy.your_rights.li4') }}</span>
            </li>
          </ul>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('privacy_policy.your_rights.p2') }}
          </p>
        </div>

        <!-- Contact -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.contact.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            <i18n-t keypath="privacy_policy.contact.p1" tag="span" scope="global">
              <template #link>
                <a
                  href="https://github.com/npmx-dev/npmx.dev/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-fg-muted hover:text-fg underline decoration-fg-subtle/50 hover:decoration-fg"
                >
                  {{ $t('privacy_policy.contact.link') }}
                  <span class="i-carbon:launch rtl-flip w-4 h-4" aria-hidden="true" />
                </a>
              </template>
            </i18n-t>
          </p>
        </div>

        <!-- Changes -->
        <div>
          <h2 class="text-lg text-fg-subtle uppercase tracking-wider mb-4">
            {{ $t('privacy_policy.changes.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed">
            {{ $t('privacy_policy.changes.p1') }}
          </p>
        </div>
      </section>
    </article>
  </main>
</template>
