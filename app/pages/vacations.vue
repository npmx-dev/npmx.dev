<script setup lang="ts">
definePageMeta({
  name: 'vacations',
  layout: 'default',
})

useSeoMeta({
  title: 'Vacations - npmx',
  description: 'The npmx team is taking a well-deserved break after an incredible sprint!',
})

const stats = [
  { label: 'Contributors', value: '150+' },
  { label: 'Commits', value: '1.1k+' },
  { label: 'PRs Merged', value: '944' },
]
</script>

<template>
  <main
    class="container flex-1 flex flex-col items-center justify-center py-20 sm:py-32 text-center"
  >
    <div class="max-w-2xl mx-auto space-y-8">
      <!-- Icon / Illustration -->
      <div class="relative inline-block">
        <div class="absolute inset-0 bg-accent/20 blur-3xl rounded-full" aria-hidden="true" />
        <span class="relative text-8xl sm:text-9xl animate-bounce-slow inline-block">🏖️</span>
      </div>

      <!-- Title -->
      <div class="space-y-4">
        <h1 class="font-mono text-4xl sm:text-5xl font-bold text-fg">
          We are <span class="text-accent">recharging</span>
        </h1>
        <p class="text-lg sm:text-xl text-fg-muted max-w-lg mx-auto leading-relaxed">
          After 3 weeks of intense coding, 150+ contributors, and over 1,100 commits, the npmx team
          is taking a short break.
        </p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-3 gap-4 sm:gap-8 py-8 border-y border-border/50">
        <div v-for="stat in stats" :key="stat.label" class="space-y-1">
          <div class="font-mono text-2xl sm:text-3xl font-bold text-fg">{{ stat.value }}</div>
          <div class="text-xs sm:text-sm text-fg-subtle uppercase tracking-wider">
            {{ stat.label }}
          </div>
        </div>
      </div>

      <!-- Message -->
      <div class="space-y-6">
        <p class="text-fg-muted">
          We'll be back soon to continue building the best package explorer for the community.
          <br class="hidden sm:block" />
          Thank you for being part of this incredible journey!
        </p>

        <div class="flex items-center justify-center gap-4">
          <ButtonBase to="/" variant="primary" size="medium" classicon="i-carbon:home">
            Back to Home
          </ButtonBase>
          <ButtonBase
            href="https://github.com/npmx-dev/npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="medium"
            classicon="i-carbon:logo-github"
          >
            Star on GitHub
          </ButtonBase>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.animate-bounce-slow {
  animation: bounce 3s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(-5%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
</style>
