export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (event.path.includes('/200.html')) {
      html.head.push('<noscript><meta http-equiv="refresh" content="1"></noscript>')
    }
  })
})
