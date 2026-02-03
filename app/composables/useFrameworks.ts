export function useFrameworks() {
  // Colors are used in the comparator charts
  const frameworks = ref([
    { name: 'nuxt', package: 'nuxt', color: 'oklch(0.7862 0.192 155.63)' },
    { name: 'vue', package: 'vue', color: 'oklch(0.7025 0.132 160.37)' },
    { name: 'nitro', package: 'nitro', color: 'oklch(70.4% 0.191 22.216)' },
    { name: 'react', package: 'react', color: 'oklch(0.832 0.1167 218.69)' },
    { name: 'svelte', package: 'svelte', color: 'oklch(0.6917 0.1865 35.04)' },
    { name: 'vite', package: 'vite', color: 'oklch(0.7484 0.1439 294.03)' },
    { name: 'next', package: 'next', color: 'oklch(71.7% .1648 250.794)' },
    { name: 'astro', package: 'astro', color: 'oklch(0.5295 0.2434 270.23)' },
    { name: 'typescript', package: 'typescript', color: 'oklch(0.5671 0.1399 253.3)' },
    { name: 'angular', package: '@angular/core', color: 'oklch(0.626 0.2663 310.4)' },
  ])

  type FrameworkName = (typeof frameworks.value)[number]['package']

  function getFrameworkColor(framework: FrameworkName): string {
    return frameworks.value.find(f => f.package === framework)!.color
  }

  function isListedFramework(name: string): name is FrameworkName {
    return frameworks.value.some(f => f.package === name)
  }

  return {
    frameworks,
    getFrameworkColor,
    isListedFramework,
  }
}
