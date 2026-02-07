/**
 * Lighthouse CI puppeteer setup script.
 *
 * Sets the color mode (light/dark) before running accessibility audits
 * and intercepts client-side API requests using the same fixture data
 * as the Playwright E2E tests.
 *
 * The color mode is determined by the LIGHTHOUSE_COLOR_MODE environment variable.
 * If not set, defaults to 'dark'.
 *
 * Request interception uses CDP (Chrome DevTools Protocol) Fetch domain
 * at the browser level, which avoids conflicts with Lighthouse's own
 * Puppeteer-level request interception.
 */

const mockRoutes = require('./test/fixtures/mock-routes.cjs')

module.exports = async function setup(browser, { url }) {
  const colorMode = process.env.LIGHTHOUSE_COLOR_MODE || 'dark'

  // Set up browser-level request interception via CDP Fetch domain.
  // This operates below Puppeteer's request interception layer so it
  // doesn't conflict with Lighthouse's own setRequestInterception usage.
  await setupCdpRequestInterception(browser)

  const page = await browser.newPage()

  // Set localStorage before navigating so @nuxtjs/color-mode picks it up
  await page.evaluateOnNewDocument(mode => {
    localStorage.setItem('npmx-color-mode', mode)
  }, colorMode)

  // Navigate and wait for DOM only - Lighthouse will do its own full load
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

  // Close the page - Lighthouse will open its own with localStorage already set
  await page.close()
}

/**
 * Set up request interception using CDP's Fetch domain on the browser's
 * default context. This intercepts requests at a lower level than Puppeteer's
 * page.setRequestInterception(), avoiding "Request is already handled!" errors
 * when Lighthouse sets up its own interception.
 *
 * @param {import('puppeteer').Browser} browser
 */
async function setupCdpRequestInterception(browser) {
  // Build URL pattern list for CDP Fetch.enable from our route definitions
  const cdpPatterns = mockRoutes.routes.map(route => ({
    urlPattern: route.pattern.replace('/**', '/*'),
    requestStage: 'Request',
  }))

  // Listen for new targets so we can attach CDP interception to each page
  browser.on('targetcreated', async target => {
    if (target.type() !== 'page') return

    try {
      const cdp = await target.createCDPSession()

      cdp.on('Fetch.requestPaused', async event => {
        const requestUrl = event.request.url
        const result = mockRoutes.matchRoute(requestUrl)

        if (result) {
          const body = Buffer.from(result.response.body).toString('base64')
          await cdp.send('Fetch.fulfillRequest', {
            requestId: event.requestId,
            responseCode: result.response.status,
            responseHeaders: [
              { name: 'Content-Type', value: result.response.contentType },
              { name: 'Access-Control-Allow-Origin', value: '*' },
            ],
            body,
          })
        } else {
          await cdp.send('Fetch.continueRequest', {
            requestId: event.requestId,
          })
        }
      })

      await cdp.send('Fetch.enable', { patterns: cdpPatterns })
    } catch {
      // Target may have been closed before we could attach.
      // This is expected for transient targets like service workers.
    }
  })
}
