const vueDataUiStylesLoaded = shallowRef(false)
let vueDataUiStylesPromise: Promise<void> | null = null

async function loadVueDataUiStyles() {
  if (vueDataUiStylesLoaded.value) {
    return
  }

  if (!vueDataUiStylesPromise) {
    vueDataUiStylesPromise = import('vue-data-ui/style.css').then(() => {
      vueDataUiStylesLoaded.value = true
    })
  }

  await vueDataUiStylesPromise
}

export function useVueDataUiStyles() {
  if (import.meta.client) {
    onMounted(() => {
      void loadVueDataUiStyles()
    })
  }

  return {
    stylesLoaded: readonly(vueDataUiStylesLoaded),
    ensureStylesLoaded: loadVueDataUiStyles,
  }
}
