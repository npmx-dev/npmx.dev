/**
 * Lighthouse CI puppeteer setup script.
 * Sets the color mode (light/dark) before running accessibility audits.
 *
 * The color mode is determined by the LIGHTHOUSE_COLOR_MODE environment variable.
 * If not set, defaults to 'dark'.
 */

module.exports = async function setup(browser, { url }) {
  const colorMode = process.env.LIGHTHOUSE_COLOR_MODE || 'dark'
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
