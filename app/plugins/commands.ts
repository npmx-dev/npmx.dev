export default defineNuxtPlugin(() => {
  const { register } = useCommandRegistry()
  const router = useRouter()

  register({
    id: 'packages:search',
    name: 'Search Packages',
    description: 'Search for npm packages',
    handler: async () => {
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[type="search"], input[name="q"]',
      )

      if (searchInput) {
        searchInput.focus()
        return
      }

      router.push('/search')
    },
  })
})
