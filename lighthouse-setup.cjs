/**
 * Lighthouse CI puppeteer setup script.
 * Sets the color mode (light/dark) before running accessibility audits.
 *
 * The color mode is determined by the LIGHTHOUSE_COLOR_MODE environment variable.
 * If not set, defaults to 'dark'.
 */

/** @param {import('puppeteer').Browser} browser */
module.exports = async function setup(browser, { url }) {
  const colorMode = process.env.LIGHTHOUSE_COLOR_MODE || 'dark'
  const page = await browser.newPage()

  // Set localStorage before navigating so @nuxtjs/color-mode picks it up
  await page.evaluateOnNewDocument(mode => {
    localStorage.setItem('npmx-color-mode', mode)
  }, colorMode)

  await page.goto(url, { waitUntil: 'networkidle0' })

  // Also set the data-theme attribute directly to ensure the mode is applied
  await page.evaluate(mode => {
    document.documentElement.setAttribute('data-theme', mode)
  }, colorMode)

  // Close the page - Lighthouse will open its own
  await page.close()
}
