const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the org page
  await page.goto('http://localhost:3000/org/atcute', { waitUntil: 'networkidle' });
  
  // Wait a bit for hydration
  await page.waitForTimeout(3000);
  
  // Check what elements exist
  const allArticles = await page.locator('article').count();
  console.log('Total articles:', allArticles);
  
  // Check for data-result-index
  const withIndex = await page.locator('[data-result-index]').count();
  console.log('Articles with data-result-index:', withIndex);
  
  // Get the first few articles' HTML
  const firstArticle = await page.locator('article').first().innerHTML();
  console.log('First article HTML (first 500 chars):', firstArticle.substring(0, 500));
  
  await browser.close();
})();
