<script setup lang="ts"></script>

<template>
  <article
    aria-busy="true"
    :aria-label="$t('package.skeleton.loading')"
    class="motion-safe:animate-fade-in"
  >
    <!-- Package header - matches header in [...name].vue -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div class="flex-1 min-w-0">
          <!-- Package name: h1 font-mono text-2xl sm:text-3xl font-medium mb-2 -->
          <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-2">
            <span class="skeleton inline-block h-9 w-48" />
          </h1>
          <!-- Description: fixed height container matching min-h-[4.5rem] (72px) to prevent CLS -->
          <div class="relative max-w-2xl min-h-[4.5rem]">
            <div class="space-y-2">
              <span class="skeleton block h-5 w-full" />
              <span class="skeleton block h-5 w-4/5" />
              <span class="skeleton block h-5 w-3/5" />
            </div>
          </div>
        </div>

        <!-- Version badge: shrink-0 px-3 py-1 font-mono text-sm bg-bg-muted border border-border rounded-md -->
        <span class="skeleton shrink-0 h-8 w-20 rounded-md" />
      </div>

      <!-- Stats grid: grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-6 -->
      <dl class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-6">
        <!-- License -->
        <div class="space-y-1">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.skeleton.license') }}
          </dt>
          <dd class="font-mono text-sm">
            <span class="skeleton inline-block h-5 w-12" />
          </dd>
        </div>

        <!-- Weekly -->
        <div class="space-y-1">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.skeleton.weekly') }}
          </dt>
          <dd class="font-mono text-sm">
            <span class="skeleton inline-block h-5 w-20" />
          </dd>
        </div>

        <!-- Size -->
        <div class="space-y-1">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.skeleton.size') }}
          </dt>
          <dd class="font-mono text-sm">
            <span class="skeleton inline-block h-5 w-16" />
          </dd>
        </div>

        <!-- Deps -->
        <div class="space-y-1">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.skeleton.deps') }}
          </dt>
          <dd class="font-mono text-sm">
            <span class="skeleton inline-block h-5 w-8" />
          </dd>
        </div>

        <!-- Updated -->
        <div class="space-y-1 col-span-2">
          <dt class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('package.skeleton.updated') }}
          </dt>
          <dd class="font-mono text-sm">
            <span class="skeleton inline-block h-5 w-28" />
          </dd>
        </div>
      </dl>

      <!-- Links: mt-6, flex flex-wrap items-center gap-4 -->
      <nav aria-label="Package links" class="mt-6">
        <ul class="flex flex-wrap items-center gap-4 list-none m-0 p-0">
          <li>
            <span class="skeleton inline-block h-5 w-14" />
          </li>
          <li>
            <span class="skeleton inline-block h-5 w-20" />
          </li>
          <li>
            <span class="skeleton inline-block h-5 w-16" />
          </li>
          <li>
            <span class="skeleton inline-block h-5 w-12" />
          </li>
        </ul>
      </nav>
    </header>

    <!-- Install section: mb-8 -->
    <section class="mb-8">
      <h2
        id="install-heading-skeleton"
        class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
      >
        {{ $t('package.skeleton.get_started') }}
      </h2>
      <!-- code-block with relative positioning for copy button -->
      <div class="relative">
        <div class="code-block pe-16">
          <span class="skeleton inline-block h-5 w-52" />
        </div>
        <span class="skeleton absolute top-3 inset-ie-3 h-6 w-12 rounded" />
      </div>
    </section>

    <!-- Two column layout: grid lg:grid-cols-3 gap-8 -->
    <div class="grid lg:grid-cols-3 gap-8">
      <!-- Main content (README): lg:col-span-2 order-2 lg:order-1 -->
      <div class="lg:col-span-2 order-2 lg:order-1">
        <section>
          <h2
            id="readme-heading-skeleton"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-4"
          >
            {{ $t('package.skeleton.readme') }}
          </h2>
          <!-- Simulated README content -->
          <div class="space-y-4">
            <!-- Heading -->
            <span class="skeleton block h-7 w-2/3" />
            <!-- Paragraphs -->
            <span class="skeleton block h-4 w-full" />
            <span class="skeleton block h-4 w-full" />
            <span class="skeleton block h-4 w-4/5" />
            <!-- Gap for section break -->
            <span class="skeleton block h-6 w-1/2 mt-6" />
            <span class="skeleton block h-4 w-full" />
            <span class="skeleton block h-4 w-full" />
            <span class="skeleton block h-4 w-3/4" />
            <!-- Code block placeholder -->
            <div class="skeleton h-24 w-full rounded-lg mt-4" />
            <span class="skeleton block h-4 w-full" />
            <span class="skeleton block h-4 w-5/6" />
          </div>
        </section>
      </div>

      <!-- Sidebar: order-1 lg:order-2 space-y-8 -->
      <div class="order-1 lg:order-2 space-y-8">
        <!-- Maintainers -->
        <section>
          <h2
            id="maintainers-heading-skeleton"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
          >
            {{ $t('package.skeleton.maintainers') }}
          </h2>
          <ul class="space-y-2 list-none m-0 p-0">
            <li>
              <span class="skeleton inline-block h-5 w-28" />
            </li>
            <li>
              <span class="skeleton inline-block h-5 w-24" />
            </li>
          </ul>
        </section>

        <!-- Keywords -->
        <section>
          <h2
            id="keywords-heading-skeleton"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
          >
            {{ $t('package.skeleton.keywords') }}
          </h2>
          <!-- flex flex-wrap gap-1.5 -->
          <ul class="flex flex-wrap gap-1.5 list-none m-0 p-0">
            <li><span class="skeleton inline-block h-6 w-16 rounded" /></li>
            <li><span class="skeleton inline-block h-6 w-12 rounded" /></li>
            <li><span class="skeleton inline-block h-6 w-20 rounded" /></li>
            <li><span class="skeleton inline-block h-6 w-14 rounded" /></li>
            <li><span class="skeleton inline-block h-6 w-18 rounded" /></li>
            <li><span class="skeleton inline-block h-6 w-10 rounded" /></li>
          </ul>
        </section>

        <!-- Versions -->
        <section>
          <h2
            id="versions-heading-skeleton"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
          >
            {{ $t('package.skeleton.versions') }}
          </h2>
          <!-- space-y-1, each row: flex items-center justify-between py-1.5 text-sm -->
          <div class="space-y-1">
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="skeleton inline-block h-4 w-16" />
              <span class="skeleton inline-block h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="skeleton inline-block h-4 w-14" />
              <span class="skeleton inline-block h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="skeleton inline-block h-4 w-18" />
              <span class="skeleton inline-block h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="skeleton inline-block h-4 w-14" />
              <span class="skeleton inline-block h-4 w-24" />
            </div>
            <div class="flex items-center justify-between py-1.5 text-sm">
              <span class="skeleton inline-block h-4 w-16" />
              <span class="skeleton inline-block h-4 w-24" />
            </div>
          </div>
        </section>

        <!-- Dependencies -->
        <section>
          <h2
            id="dependencies-heading-skeleton"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
          >
            {{ $t('package.skeleton.dependencies') }}
          </h2>
          <!-- space-y-1, each: flex items-center justify-between py-1 text-sm -->
          <ul class="space-y-1 list-none m-0 p-0">
            <li class="flex items-center justify-between py-1 text-sm">
              <span class="skeleton inline-block h-4 w-24" />
              <span class="skeleton inline-block h-4 w-12" />
            </li>
            <li class="flex items-center justify-between py-1 text-sm">
              <span class="skeleton inline-block h-4 w-32" />
              <span class="skeleton inline-block h-4 w-10" />
            </li>
            <li class="flex items-center justify-between py-1 text-sm">
              <span class="skeleton inline-block h-4 w-20" />
              <span class="skeleton inline-block h-4 w-14" />
            </li>
            <li class="flex items-center justify-between py-1 text-sm">
              <span class="skeleton inline-block h-4 w-28" />
              <span class="skeleton inline-block h-4 w-12" />
            </li>
          </ul>
        </section>
      </div>
    </div>
  </article>
</template>
