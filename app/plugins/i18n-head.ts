export default defineNuxtPlugin(() => {
  const localeHead = useLocaleHead({ dir: true, lang: true, seo: true })

  useHead(() => ({
    htmlAttrs: localeHead.value.htmlAttrs,
  }))
})
