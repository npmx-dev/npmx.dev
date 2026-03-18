export default defineNitroPlugin(nitroApp => {
  if (import.meta.prerender) {
    nitroApp.hooks.hook('render:html', (html, { event }) => {
      if (event.path === '/200.html') {
        html.head.push('<noscript><meta http-equiv="refresh" content="1"></noscript>')
      }
    })
  }
})
