export default defineNuxtPlugin(() => {
  const { register } = useCommandRegistry()
  const router = useRouter()

  const { t } = useI18n()

  register({
    id: 'packages:search',
    name: t('command.package_search'),
    description: t('command.package_search_desc'),
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
