<script setup lang="ts">
import { ACCENT_COLORS, DISCORD_COMMUNITY_URL } from '#shared/utils/constants'

useSeoMeta({
  title: () => `${$t('brand.title')} - npmx`,
  ogTitle: () => `${$t('brand.title')} - npmx`,
  twitterTitle: () => `${$t('brand.title')} - npmx`,
  description: () => $t('brand.meta_description'),
  ogDescription: () => $t('brand.meta_description'),
  twitterDescription: () => $t('brand.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => $t('brand.title'),
    description: () => $t('brand.meta_description'),
  },
  { alt: () => `${$t('brand.title')} — npmx` },
)

const logos = [
  {
    name: () => $t('brand.logos.wordmark'),
    src: '/logo.svg',
    srcLight: '/logo-light.svg',
    altDark: () => $t('brand.logos.wordmark_alt'),
    altLight: () => $t('brand.logos.wordmark_light_alt'),
    width: 602,
    height: 170,
    span: true,
  },
  {
    name: () => $t('brand.logos.mark'),
    src: '/logo-mark.svg',
    srcLight: '/logo-mark-light.svg',
    altDark: () => $t('brand.logos.mark_alt'),
    altLight: () => $t('brand.logos.mark_light_alt'),
    width: 153,
    height: 153,
    span: true,
  },
]

const typographySizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm']

const svgLoading = ref(new Set<string>())
const pngLoading = ref(new Set<string>())

function handleSvgDownload(src: string) {
  if (svgLoading.value.has(src)) return
  svgLoading.value.add(src)
  try {
    downloadFileLink(src, src.replace('/', ''))
  } finally {
    svgLoading.value.delete(src)
  }
}

async function handlePngDownload(logo: (typeof logos)[number], variant: 'dark' | 'light' = 'dark') {
  const src = variant === 'light' ? (logo.srcLight ?? logo.src) : logo.src
  if (pngLoading.value.has(src)) return
  pngLoading.value.add(src)
  try {
    const blob = await svgToPng(src, logo.width, logo.height)
    const filename = src.replace(/^\//, '').replace('.svg', '.png')
    downloadFile(blob, filename)
  } finally {
    pngLoading.value.delete(src)
  }
}
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <!-- Header -->
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('brand.heading') }}
          </h1>
          <BackButton />
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('brand.intro') }}
        </p>
      </header>

      <div class="flex flex-col gap-16">
        <!-- Logos Section -->
        <section aria-labelledby="brand-logos-heading">
          <h2 id="brand-logos-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.logos.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.logos.description') }}
          </p>

          <div>
            <figure
              v-for="logo in logos"
              :key="logo.src"
              class="m-0 mt-12 first:mt-0"
              role="group"
              :aria-label="logo.name()"
            >
              <figcaption class="font-mono text-sm text-fg mb-3">
                {{ logo.name() }}
              </figcaption>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Dark variant -->
                <div class="flex flex-col">
                  <div
                    class="bg-[#0a0a0a] rounded-lg p-6 sm:p-8 flex items-center justify-center border border-border min-h-40 flex-1"
                  >
                    <img
                      :src="logo.src"
                      :alt="logo.altDark()"
                      class="max-h-16 w-auto max-w-full"
                      :class="{ 'max-h-20': logo.span }"
                    />
                  </div>
                  <div class="flex items-center justify-between mt-2">
                    <span class="text-sm text-fg-subtle font-mono">{{
                      $t('brand.logos.on_dark')
                    }}</span>
                    <div class="flex items-center gap-2">
                      <ButtonBase
                        size="md"
                        :aria-label="
                          $t('brand.logos.download_svg_aria', {
                            name: `${logo.name()} (${$t('brand.logos.on_dark')})`,
                          })
                        "
                        :disabled="svgLoading.has(logo.src)"
                        @click="handleSvgDownload(logo.src)"
                      >
                        <span
                          class="size-[1em]"
                          aria-hidden="true"
                          :class="
                            svgLoading.has(logo.src)
                              ? 'i-lucide:loader-circle animate-spin'
                              : 'i-lucide:download'
                          "
                        />
                        {{ $t('brand.logos.download_svg') }}
                      </ButtonBase>
                      <ButtonBase
                        size="md"
                        :aria-label="
                          $t('brand.logos.download_png_aria', {
                            name: `${logo.name()} (${$t('brand.logos.on_dark')})`,
                          })
                        "
                        :disabled="pngLoading.has(logo.src)"
                        @click="handlePngDownload(logo)"
                      >
                        <span
                          class="size-[1em]"
                          aria-hidden="true"
                          :class="
                            pngLoading.has(logo.src)
                              ? 'i-lucide:loader-circle animate-spin'
                              : 'i-lucide:download'
                          "
                        />
                        {{ $t('brand.logos.download_png') }}
                      </ButtonBase>
                    </div>
                  </div>
                </div>

                <!-- Light variant -->
                <div class="flex flex-col">
                  <div
                    class="bg-white rounded-lg p-6 sm:p-8 flex items-center justify-center border border-border min-h-40 flex-1"
                  >
                    <AppLogo
                      v-if="logo.src === '/logo.svg'"
                      class="max-h-20 w-auto max-w-full text-[#0a0a0a]"
                      :style="{ '--accent': ACCENT_COLORS.light.sky }"
                      :aria-label="logo.altLight()"
                    />
                    <img
                      v-else
                      :src="logo.srcLight ?? logo.src"
                      :alt="logo.altLight()"
                      class="max-h-16 w-auto max-w-full"
                      :class="{ 'max-h-20': logo.span }"
                    />
                  </div>
                  <div class="flex items-center justify-between mt-2">
                    <span class="text-sm text-fg-subtle font-mono">{{
                      $t('brand.logos.on_light')
                    }}</span>
                    <div class="flex items-center gap-2">
                      <ButtonBase
                        size="md"
                        :aria-label="
                          $t('brand.logos.download_svg_aria', {
                            name: `${logo.name()} (${$t('brand.logos.on_light')})`,
                          })
                        "
                        :disabled="svgLoading.has(logo.srcLight ?? logo.src)"
                        @click="handleSvgDownload(logo.srcLight ?? logo.src)"
                      >
                        <span
                          class="size-[1em]"
                          aria-hidden="true"
                          :class="
                            svgLoading.has(logo.srcLight ?? logo.src)
                              ? 'i-lucide:loader-circle animate-spin'
                              : 'i-lucide:download'
                          "
                        />
                        {{ $t('brand.logos.download_svg') }}
                      </ButtonBase>
                      <ButtonBase
                        size="md"
                        :aria-label="
                          $t('brand.logos.download_png_aria', {
                            name: `${logo.name()} (${$t('brand.logos.on_light')})`,
                          })
                        "
                        :disabled="pngLoading.has(logo.srcLight ?? logo.src)"
                        @click="handlePngDownload(logo, 'light')"
                      >
                        <span
                          class="size-[1em]"
                          aria-hidden="true"
                          :class="
                            pngLoading.has(logo.srcLight ?? logo.src)
                              ? 'i-lucide:loader-circle animate-spin'
                              : 'i-lucide:download'
                          "
                        />
                        {{ $t('brand.logos.download_png') }}
                      </ButtonBase>
                    </div>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        <!-- Customize Section -->
        <BrandCustomize />

        <!-- Typography Section -->
        <section aria-labelledby="brand-typography-heading">
          <h2 id="brand-typography-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.typography.title') }}
          </h2>
          <p class="text-fg-muted leading-relaxed mb-8">
            {{ $t('brand.typography.description') }}
          </p>

          <div class="space-y-10">
            <!-- Geist Sans -->
            <div>
              <h3 class="font-mono text-sm text-fg uppercase tracking-wider mb-1">
                {{ $t('brand.typography.sans') }}
              </h3>
              <p class="text-fg-subtle text-sm mb-4 m-0">
                {{ $t('brand.typography.sans_desc') }}
              </p>
              <div class="space-y-2 border border-border rounded-lg p-6">
                <p
                  v-for="size in typographySizes"
                  :key="`sans-${size}`"
                  class="font-sans text-fg m-0"
                  :class="size"
                >
                  {{ $t('brand.typography.pangram') }}
                </p>
                <p class="font-sans text-fg text-lg m-0 mt-4 tracking-widest">
                  {{ $t('brand.typography.numbers') }}
                </p>
              </div>
            </div>

            <!-- Geist Mono -->
            <div>
              <h3 class="font-mono text-sm text-fg uppercase tracking-wider mb-1">
                {{ $t('brand.typography.mono') }}
              </h3>
              <p class="text-fg-subtle text-sm mb-4 m-0">
                {{ $t('brand.typography.mono_desc') }}
              </p>
              <div class="space-y-2 border border-border rounded-lg p-6">
                <p
                  v-for="size in typographySizes"
                  :key="`mono-${size}`"
                  class="font-mono text-fg m-0"
                  :class="size"
                >
                  {{ $t('brand.typography.pangram') }}
                </p>
                <p class="font-mono text-fg text-lg m-0 mt-4 tracking-widest">
                  {{ $t('brand.typography.numbers') }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Guidelines -->
        <section aria-labelledby="brand-guidelines-heading">
          <h2 id="brand-guidelines-heading" class="text-lg text-fg uppercase tracking-wider mb-4">
            {{ $t('brand.guidelines.title') }}
          </h2>
          <blockquote class="border-is-2 border-is-accent ps-6 py-2 text-fg-muted leading-relaxed">
            <i18n-t keypath="brand.guidelines.message" tag="p" class="m-0">
              <template #link>
                <a
                  :href="DISCORD_COMMUNITY_URL"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-accent hover:underline"
                  >{{ $t('brand.guidelines.discord_link_text') }}</a
                >
              </template>
            </i18n-t>
          </blockquote>
        </section>
      </div>
    </article>
  </main>
</template>
