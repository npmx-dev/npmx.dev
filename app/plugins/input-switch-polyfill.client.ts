export default defineNuxtPlugin(async () => {
  if (!('switch' in HTMLInputElement.prototype)) {
    // @ts-expect-error input-switch-polyfill ships no types; imported for its side effect only
    await import('input-switch-polyfill')

    // The polyfill reads `accent-color` once at upgrade time and freezes the
    // resolved color as `--switch-accent` in each element's inline style.
    // Re-sync whenever the accent or color-mode changes so switches react live.
    const syncSwitchAccent = () => {
      const switches = document.querySelectorAll<HTMLInputElement>('input.switch')
      const [first] = switches
      if (!first) return
      // All switches share the same cascade; read from the first one.
      const color = getComputedStyle(first).getPropertyValue('accent-color').trim()
      if (!color || color === 'auto') return
      for (const el of switches) {
        el.style.setProperty('--switch-accent', color)
      }
    }

    new MutationObserver(syncSwitchAccent).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })
  }
})
