<script setup lang="ts"></script>

<template>
  <article
    aria-busy="true"
    :aria-label="$t('package.skeleton.loading')"
    class="package-page motion-safe:animate-fade-in"
  >
    <!-- Package header — matches area-header in [...name].vue -->
    <header class="area-header sticky top-14 z-1 bg-[--bg] py-2">
      <div class="flex items-baseline gap-x-2 gap-y-1 sm:gap-x-3 flex-wrap min-w-0">
        <!-- Package name -->
        <div class="min-w-0">
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">
            <SkeletonInline class="h-9 w-48" />
          </h1>
        </div>
        <!-- Version -->
        <span class="inline-flex items-baseline font-mono text-base sm:text-lg shrink-0">
          <SkeletonInline class="h-6 w-20" />
        </span>

        <!-- Docs + Code + Compare nav placeholder (hidden on mobile) -->
        <div
          class="hidden sm:flex items-center gap-0.5 p-0.5 bg-bg-subtle border border-border-subtle rounded-md shrink-0 ms-auto self-center"
        >
          <SkeletonInline class="h-7 w-22 rounded" />
          <SkeletonInline class="h-7 w-20 rounded" />
          <SkeletonInline class="h-7 w-26 rounded" />
        </div>

        <!-- Metrics badges + likes — matches basis-full flex row -->
        <div class="basis-full flex gap-2 sm:gap-3 flex-wrap items-stretch">
          <!-- Badge row (Types, ESM, CJS, CJS-ghost) -->
          <div class="flex items-center gap-1.5 self-baseline">
            <SkeletonBlock class="w-16 h-5.5 rounded" />
            <SkeletonBlock class="w-13 h-5.5 rounded" />
            <SkeletonBlock class="w-13 h-5.5 rounded" />
            <SkeletonBlock class="w-13 h-5.5 rounded bg-bg-subtle" />
          </div>
          <!-- Likes button placeholder -->
          <SkeletonBlock class="w-14 h-5.5 rounded self-baseline" />
        </div>
      </div>
    </header>

    <!-- Package details — matches area-details in [...name].vue -->
    <section class="area-details">
      <div class="mb-4">
        <!-- Description -->
        <div class="max-w-2xl">
          <div class="space-y-2">
            <SkeletonBlock class="h-5 w-full" />
            <SkeletonBlock class="h-5 w-4/5" />
            <SkeletonBlock class="h-5 w-3/5" />
          </div>
        </div>

        <!-- External links -->
        <ul
          class="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-4 list-none m-0 p-0 mt-3 text-sm"
        >
          <li><SkeletonInline class="h-5 w-28" /></li>
          <li><SkeletonInline class="h-5 w-14" /></li>
          <li><SkeletonInline class="h-5 w-16" /></li>
          <li><SkeletonInline class="h-5 w-10" /></li>
        </ul>
      </div>

      <!-- Stats grid — matches dl in [...name].vue -->
      <dl
        class="grid grid-cols-2 sm:grid-cols-7 md:grid-cols-11 gap-3 sm:gap-4 py-4 sm:py-6 mt-4 sm:mt-6 border-t border-b border-border"
      >
        <!-- License -->
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.stats.license') }}
          </dt>
          <dd class="font-mono text-sm">
            <SkeletonInline class="h-5 w-12" />
          </dd>
        </div>

        <!-- Deps -->
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.stats.deps') }}
          </dt>
          <dd class="font-mono text-sm">
            <SkeletonInline class="h-5 w-12" />
          </dd>
        </div>

        <!-- Install Size -->
        <div class="space-y-1 sm:col-span-3">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.stats.install_size') }}
          </dt>
          <dd class="font-mono text-sm">
            <SkeletonInline class="h-5 w-16" />
          </dd>
        </div>

        <!-- Vulns -->
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.stats.vulns') }}
          </dt>
          <dd class="font-mono text-sm text-fg-subtle">-</dd>
        </div>

        <!-- Published -->
        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.stats.published') }}
          </dt>
          <dd class="font-mono text-sm">
            <SkeletonInline class="h-5 w-28" />
          </dd>
        </div>
      </dl>
    </section>

    <!-- Install section — matches area-install in [...name].vue -->
    <section class="area-install scroll-mt-20">
      <div class="flex flex-wrap items-center justify-between mb-3">
        <h2 class="text-xs font-mono text-fg-subtle uppercase tracking-wider">
          {{ $t('package.get_started.title') }}
        </h2>
        <!-- Package manager select placeholder -->
        <SkeletonInline class="h-7 w-24 rounded" />
      </div>
      <!-- Terminal-style install command — matches TerminalInstall.vue -->
      <div class="bg-bg-subtle border border-border rounded-lg overflow-hidden">
        <div class="flex gap-1.5 px-3 pt-2 sm:px-4 sm:pt-3">
          <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
          <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
          <span class="w-2.5 h-2.5 rounded-full bg-fg-subtle" />
        </div>
        <div class="px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 space-y-1">
          <!-- $ install command -->
          <div class="flex items-center gap-2">
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <SkeletonInline class="h-5 w-40" />
          </div>
          <!-- # Run locally -->
          <div class="flex items-center gap-2 pt-1">
            <SkeletonInline class="h-4 w-24" />
          </div>
          <!-- $ run command -->
          <div class="flex items-center gap-2">
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <SkeletonInline class="h-5 w-28" />
          </div>
          <!-- # Create new project -->
          <div class="flex items-center gap-2 pt-1">
            <SkeletonInline class="h-4 w-36" />
          </div>
          <!-- $ create command -->
          <div class="flex items-center gap-2">
            <span class="text-fg-subtle font-mono text-sm select-none shrink-0">$</span>
            <SkeletonInline class="h-5 w-32" />
          </div>
        </div>
      </div>
    </section>

    <!-- Vulns area (empty placeholder to hold grid space) -->
    <div class="area-vulns" />

    <!-- README — matches area-readme in [...name].vue -->
    <section class="area-readme min-w-0 scroll-mt-20">
      <div class="flex flex-wrap items-center justify-between mb-3 px-1">
        <h2 class="text-xs font-mono text-fg-subtle uppercase tracking-wider">
          {{ $t('package.readme.title') }}
        </h2>
      </div>
      <!-- Simulated README content -->
      <div class="space-y-4">
        <!-- Heading -->
        <SkeletonBlock class="h-7 w-2/3" />
        <!-- Paragraphs -->
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-4/5" />
        <!-- Gap for section break -->
        <SkeletonBlock class="h-6 w-1/2 mt-6" />
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-3/4" />
        <!-- Code block placeholder -->
        <SkeletonBlock class="h-24 w-full rounded-lg mt-4" />
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-5/6" />
      </div>
    </section>

    <!-- Sidebar — matches area-sidebar in [...name].vue -->
    <div class="area-sidebar">
      <div
        class="sticky top-30 xl:top-14 space-y-6 sm:space-y-8 min-w-0 overflow-y-auto pe-2.5 lg:(max-h-[calc(100dvh-8.5rem)] overscroll-contain) xl:(pt-2 max-h-[calc(100dvh-6rem)])"
      >
        <div class="flex flex-col gap-4 sm:gap-6 xl:(pt-2)">
          <!-- Download stats — matches CollapsibleSection + sparkline skeleton -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.downloads.title') }}
              </h2>
            </div>
            <div class="ms-6 max-w-xs">
              <!-- Title row: fontSize * 2 = 24px -->
              <div class="h-6 flex items-center ps-3">
                <SkeletonInline class="h-3 w-36" />
              </div>
              <!-- Chart area: matches SVG viewBox 500:80 -->
              <div class="aspect-[500/80] flex items-center">
                <div class="w-[42%] flex items-center ps-0.5">
                  <SkeletonInline class="h-7 w-24" />
                </div>
                <div class="flex-1 flex items-end pe-3">
                  <SkeletonInline class="h-px w-full" />
                </div>
              </div>
            </div>
          </section>

          <!-- Playgrounds — matches PackagePlaygrounds (not CollapsibleSection) -->
          <section class="px-1">
            <h2 class="text-xs font-mono text-fg-subtle uppercase tracking-wider mb-3">
              {{ $t('package.playgrounds.title') }}
            </h2>
            <SkeletonBlock class="w-full h-9 rounded-md" />
          </section>

          <!-- Compatibility — matches CollapsibleSection -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.compatibility') }}
              </h2>
            </div>
            <div class="ms-6 space-y-2">
              <div class="flex justify-between gap-4 py-1">
                <SkeletonInline class="h-4 w-16" />
                <SkeletonInline class="h-4 w-20" />
              </div>
            </div>
          </section>

          <!-- Versions — matches CollapsibleSection + PackageVersions -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.skeleton.versions') }}
              </h2>
            </div>
            <div class="ms-6 space-y-0.5 min-w-0">
              <!-- Version rows with expand chevron + version + tag + date -->
              <div v-for="i in 4" :key="i" class="flex items-center gap-2 px-1">
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-right w-3 h-3 text-fg-subtle" aria-hidden="true" />
                </span>
                <div class="flex-1 py-1.5 min-w-0 flex gap-2 justify-between items-center">
                  <div>
                    <SkeletonInline
                      class="h-4"
                      :class="i === 1 ? 'w-12' : i === 2 ? 'w-22' : i === 3 ? 'w-26' : 'w-14'"
                    />
                    <SkeletonInline class="h-2.5 w-10 mt-0.5" />
                  </div>
                  <SkeletonInline class="h-3 w-20 shrink-0" />
                </div>
              </div>
              <!-- Other versions row -->
              <div class="flex items-center gap-2 p-1">
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-right w-3 h-3 text-fg-subtle" aria-hidden="true" />
                </span>
                <SkeletonInline class="h-3 w-28" />
              </div>
            </div>
          </section>

          <!-- Dependencies — matches CollapsibleSection -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.skeleton.dependencies') }}
              </h2>
            </div>
            <ul class="ms-6 px-1 space-y-1 list-none m-0 p-0">
              <li class="flex items-center justify-between py-1 text-sm">
                <SkeletonInline class="h-4 w-24" />
                <SkeletonInline class="h-4 w-12" />
              </li>
              <li class="flex items-center justify-between py-1 text-sm">
                <SkeletonInline class="h-4 w-32" />
                <SkeletonInline class="h-4 w-10" />
              </li>
              <li class="flex items-center justify-between py-1 text-sm">
                <SkeletonInline class="h-4 w-20" />
                <SkeletonInline class="h-4 w-14" />
              </li>
              <li class="flex items-center justify-between py-1 text-sm">
                <SkeletonInline class="h-4 w-28" />
                <SkeletonInline class="h-4 w-12" />
              </li>
            </ul>
          </section>

          <!-- Keywords — matches CollapsibleSection -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.skeleton.keywords') }}
              </h2>
            </div>
            <ul class="ms-6 flex flex-wrap gap-1.5 list-none m-0 p-1">
              <li><SkeletonInline class="h-6 w-16 rounded" /></li>
              <li><SkeletonInline class="h-6 w-12 rounded" /></li>
              <li><SkeletonInline class="h-6 w-20 rounded" /></li>
              <li><SkeletonInline class="h-6 w-14 rounded" /></li>
              <li><SkeletonInline class="h-6 w-18 rounded" /></li>
              <li><SkeletonInline class="h-6 w-10 rounded" /></li>
            </ul>
          </section>

          <!-- Maintainers — matches CollapsibleSection -->
          <section>
            <div class="flex items-center justify-between mb-3 px-1">
              <h2
                class="text-xs font-mono text-fg-subtle uppercase tracking-wider flex items-center gap-2"
              >
                <span class="w-4 h-4 flex items-center justify-center shrink-0">
                  <span class="i-lucide:chevron-down w-3 h-3" aria-hidden="true" />
                </span>
                {{ $t('package.skeleton.maintainers') }}
              </h2>
            </div>
            <ul class="ms-6 space-y-2 list-none my-1 px-1">
              <li><SkeletonInline class="h-5 w-28" /></li>
              <li><SkeletonInline class="h-5 w-24" /></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.package-page {
  display: grid;
  gap: 2rem;

  /* Mobile: single column, sidebar above readme */
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'header'
    'details'
    'install'
    'vulns'
    'sidebar'
    'readme';
}

/* Tablet/medium: header/install/vulns full width, readme+sidebar side by side */
@media (min-width: 1024px) {
  .package-page {
    grid-template-columns: 2fr 1fr;
    grid-template-areas:
      'header  header'
      'details details'
      'install install'
      'vulns   vulns'
      'readme  sidebar';
    grid-template-rows: auto auto auto auto 1fr;
  }
}

/* Desktop: floating sidebar alongside all content */
@media (min-width: 1280px) {
  .package-page {
    grid-template-columns: 1fr 20rem;
    grid-template-areas:
      'header  sidebar'
      'details sidebar'
      'install sidebar'
      'vulns   sidebar'
      'readme  sidebar';
  }
}

.area-header {
  grid-area: header;
}

.area-details {
  grid-area: details;
}

.area-install {
  grid-area: install;
}

.area-vulns {
  grid-area: vulns;
}

.area-readme {
  grid-area: readme;
  overflow-x: hidden;
}

.area-sidebar {
  grid-area: sidebar;
}

/* Sidebar scrollbar: hidden by default, shown on hover/focus */
@media (min-width: 1024px) {
  .sidebar-scroll {
    scrollbar-gutter: stable;
    scrollbar-width: 8px;
    scrollbar-color: transparent transparent;
  }

  .sidebar-scroll::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .sidebar-scroll::-webkit-scrollbar-track,
  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: transparent;
  }

  .sidebar-scroll:hover,
  .sidebar-scroll:focus-within {
    scrollbar-color: var(--border) transparent;
  }

  .sidebar-scroll:hover::-webkit-scrollbar-thumb,
  .sidebar-scroll:focus-within::-webkit-scrollbar-thumb {
    background-color: var(--border);
    border-radius: 9999px;
  }

  .sidebar-scroll:hover::-webkit-scrollbar-track,
  .sidebar-scroll:focus-within::-webkit-scrollbar-track {
    background: transparent;
  }
}
</style>
