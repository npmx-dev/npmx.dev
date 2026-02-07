<script setup lang="ts"></script>

<template>
  <article
    aria-busy="true"
    :aria-label="$t('package.skeleton.loading')"
    class="package-page motion-safe:animate-fade-in"
  >
    <!-- Package header — matches area-header in [...name].vue -->
    <header class="area-header sticky top-14 z-1 bg-[--bg] py-2">
      <div class="flex items-baseline gap-2 sm:gap-3 flex-wrap min-w-0">
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
        <!-- Metrics badges placeholder -->
        <div class="flex items-center gap-1.5 relative top-[5px] self-baseline ms-1 sm:ms-2">
          <SkeletonBlock class="w-16 h-5.5 rounded" />
          <SkeletonBlock class="w-13 h-5.5 rounded" />
          <SkeletonBlock class="w-13 h-5.5 rounded" />
          <SkeletonBlock class="w-13 h-5.5 rounded bg-bg-subtle" />
        </div>
        <!-- Internal navigation placeholder (hidden on mobile) -->
        <div
          class="hidden sm:flex items-center gap-0.5 p-0.5 bg-bg-subtle border border-border-subtle rounded-md shrink-0 ms-auto self-center"
        >
          <SkeletonInline class="h-7 w-16 rounded" />
          <SkeletonInline class="h-7 w-14 rounded" />
          <SkeletonInline class="h-7 w-20 rounded" />
        </div>
      </div>
    </header>

    <!-- Package details — matches area-details in [...name].vue -->
    <section class="area-details">
      <div class="mb-4">
        <!-- Description container with min-height to prevent CLS -->
        <div class="max-w-2xl min-h-[4.5rem]">
          <div class="space-y-2">
            <SkeletonBlock class="h-5 w-full" />
            <SkeletonBlock class="h-5 w-4/5" />
            <SkeletonBlock class="h-5 w-3/5" />
          </div>
        </div>

        <!-- External links -->
        <ul class="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-4 list-none m-0 p-0 mt-3">
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
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">
          {{ $t('package.get_started.title') }}
        </h2>
        <!-- Package manager select placeholder -->
        <SkeletonInline class="h-7 w-24 rounded" />
      </div>
      <!-- Install command code block -->
      <div class="relative">
        <div
          class="bg-bg-muted border border-border rounded-md p-4 font-mono text-sm overflow-x-auto pe-16"
        >
          <SkeletonInline class="h-5 w-52" />
        </div>
        <SkeletonInline class="absolute top-3 inset-ie-3 h-6 w-12 rounded" />
      </div>
    </section>

    <!-- Vulns area (empty placeholder to hold grid space) -->
    <div class="area-vulns" />

    <!-- README — matches area-readme in [...name].vue -->
    <section class="area-readme min-w-0 scroll-mt-20">
      <div class="flex flex-wrap items-center justify-between mb-3 px-1">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">
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
        class="sidebar-scroll sticky top-34 space-y-6 sm:space-y-8 min-w-0 overflow-y-auto pe-2.5 lg:(max-h-[calc(100dvh-8.5rem)] overscroll-contain) xl:(top-22 pt-2 max-h-[calc(100dvh-6rem)])"
      >
        <!-- Download stats -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('package.skeleton.weekly') }}
          </h2>
          <!-- Chart placeholder -->
          <SkeletonBlock class="h-32 w-full rounded-lg" />
        </section>

        <!-- Versions -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('package.skeleton.versions') }}
          </h2>
          <div class="space-y-1">
            <div class="flex items-center justify-between py-1.5 text-sm">
              <SkeletonInline class="h-4 w-16" />
              <SkeletonInline class="h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <SkeletonInline class="h-4 w-14" />
              <SkeletonInline class="h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <SkeletonInline class="h-4 w-18" />
              <SkeletonInline class="h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <SkeletonInline class="h-4 w-14" />
              <SkeletonInline class="h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <SkeletonInline class="h-4 w-16" />
              <SkeletonInline class="h-4 w-24" />
            </div>
          </div>
        </section>

        <!-- Dependencies -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('package.skeleton.dependencies') }}
          </h2>
          <ul class="space-y-1 list-none m-0 p-0">
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

        <!-- Keywords -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('package.skeleton.keywords') }}
          </h2>
          <ul class="flex flex-wrap gap-1.5 list-none m-0 p-0">
            <li><SkeletonInline class="h-6 w-16 rounded" /></li>
            <li><SkeletonInline class="h-6 w-12 rounded" /></li>
            <li><SkeletonInline class="h-6 w-20 rounded" /></li>
            <li><SkeletonInline class="h-6 w-14 rounded" /></li>
            <li><SkeletonInline class="h-6 w-18 rounded" /></li>
            <li><SkeletonInline class="h-6 w-10 rounded" /></li>
          </ul>
        </section>

        <!-- Maintainers -->
        <section>
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('package.skeleton.maintainers') }}
          </h2>
          <ul class="space-y-2 list-none m-0 p-0">
            <li><SkeletonInline class="h-5 w-28" /></li>
            <li><SkeletonInline class="h-5 w-24" /></li>
          </ul>
        </section>
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
