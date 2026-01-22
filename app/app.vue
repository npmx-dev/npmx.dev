<script setup lang="ts">
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? titleChunk : 'npmx - Better npm Package Browser'
  },
})
</script>

<template>
  <div>
    <a
      href="#main-content"
      class="skip-link"
    >Skip to main content</a>
    <header>
      <nav aria-label="Main navigation">
        <NuxtLink
          to="/"
          aria-label="npmx home"
        >
          npmx
        </NuxtLink>
        <ul>
          <li>
            <NuxtLink to="/search">
              Search
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </header>
    <div id="main-content">
      <NuxtPage />
    </div>
    <footer>
      <p>
        <a
          href="https://github.com/danielroe/npmx.dev"
          rel="noopener noreferrer"
        >Source on GitHub</a>
      </p>
    </footer>
  </div>
</template>
