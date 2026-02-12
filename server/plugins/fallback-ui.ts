export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    if (event.path === '/spa.prerender-fallback.html') {
      html.head.push(`
        <noscript>
          <style>
            .noscript-container {
              display: flex; flex-direction: column; align-items: center; 
              justify-content: center; height: 100vh; font-family: sans-serif;
              background: #0a0a0a; color: white; text-align: center;
            }
            .refresh-button {
              margin-top: 20px; padding: 12px 24px; background: #444; 
              color: white; text-decoration: none; border-radius: 6px;
              border: 1px solid #666; cursor: pointer;
            }
            .refresh-button:hover { background: #555; }
          </style>
        </noscript>
      `)

      html.bodyAppend.push(`
        <noscript>
          <div class="noscript-container">
            <h2>Generating Page...</h2>
            <p>This page hasn't been cached yet. Click below to view the content.</p>
            <a href="." class="refresh-button">Check for Content</a>
          </div>
        </noscript>
      `)
    }
  })
})
