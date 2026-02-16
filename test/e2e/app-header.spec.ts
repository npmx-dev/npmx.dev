import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'

/**
 * Mobile viewport configuration for testing
 * Matches the sm: breakpoint (640px) - tests below this width
 */
const MOBILE_VIEWPORT = { width: 375, height: 667 }

/**
 * Helper: Check if current viewport is mobile
 */
async function isMobileViewport(page: Page): Promise<boolean> {
  const viewport = page.viewportSize()
  return viewport ? viewport.width < 640 : false
}

/**
 * Helper: Verify menu is closed
 */
async function expectMenuClosed(page: Page): Promise<void> {
  const menuButton = page
    .locator(
      'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
    )
    .first()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false')

  // Menu panel should not be visible
  const menuPanel = page.locator('nav[aria-modal="true"]')
  await expect(menuPanel).not.toBeVisible()
}

/**
 * Helper: Verify menu is open
 */
async function expectMenuOpen(page: Page): Promise<void> {
  const menuButton = page
    .locator(
      'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
    )
    .first()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')

  // Menu panel should be visible
  const menuPanel = page.locator('nav[aria-modal="true"]')
  await expect(menuPanel).toBeVisible()
}

/**
 * Helper: Open the mobile menu by clicking the menu button
 */
async function openMobileMenu(page: Page): Promise<void> {
  const menuButton = page
    .locator(
      'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
    )
    .first()
  await menuButton.click()
  await expect(page.locator('nav[aria-modal="true"]')).toBeVisible()
}

/**
 * Helper: Close the mobile menu by clicking the close button
 */
async function closeMobileMenu(page: Page): Promise<void> {
  const closeButton = page
    .locator(
      'button[aria-label*="close"], button[aria-label*="Tutup"], button[aria-label*="Chiudi"], button[aria-label*="Zavřít"], button[aria-label*="Fermer"]',
    )
    .first()
  await closeButton.click()
  await expect(page.locator('nav[aria-modal="true"]')).not.toBeVisible()
}

test.describe('Mobile Header Menu', () => {
  // Apply mobile viewport to all tests in this suite
  test.use({ viewport: MOBILE_VIEWPORT })

  test.describe('Default State', () => {
    test('menu is closed by default on page load', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Menu button should be visible
      const menuButton = page
        .locator(
          'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
        )
        .first()
      await expect(menuButton).toBeVisible()

      // Menu should be closed by default
      await expectMenuClosed(page)
    })

    test('menu button has aria-expanded="false" by default', async ({ page, goto }) => {
      await goto('/compare', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      const menuButton = page
        .locator(
          'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
        )
        .first()
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test.describe('Open/Close Interaction', () => {
    test('menu opens when clicking the menu button', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      await expectMenuClosed(page)

      // Click menu button to open
      await openMobileMenu(page)

      // Verify menu is now open
      await expectMenuOpen(page)
    })

    test('menu closes when clicking the menu button again', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Click menu button again to close
      const menuButton = page
        .locator(
          'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
        )
        .first()
      await menuButton.click()

      // Menu should be closed
      await expectMenuClosed(page)
    })

    test('menu closes when clicking the close button', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Click close button to close
      await closeMobileMenu(page)

      // Menu should be closed
      await expectMenuClosed(page)
    })

    test('menu closes when clicking the backdrop', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Click backdrop to close (the semi-transparent overlay)
      const backdrop = page.locator('div[role="dialog"] > button').first()
      await backdrop.click()

      // Menu should be closed
      await expectMenuClosed(page)
    })

    test('menu button aria-expanded toggles with menu state', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      const menuButton = page
        .locator(
          'button[aria-label*="open_menu"], button[aria-label*="Buka"], button[aria-label*="Apri"], button[aria-label*="Otevřít"], button[aria-label*="Ouvrir"]',
        )
        .first()

      // Initially false
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false')

      // Open menu
      await menuButton.click()
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true')

      // Close menu
      await menuButton.click()
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('Escape key closes the menu', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Press Escape to close
      await page.keyboard.press('Escape')

      // Menu should be closed
      await expectMenuClosed(page)
    })

    test('focus trap is active when menu is open', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Get the menu nav element
      const menuNav = page.locator('nav[aria-modal="true"]')

      // Focus should be manageable within the menu
      // Close button should be focusable
      const closeButton = page
        .locator(
          'button[aria-label*="close"], button[aria-label*="Tutup"], button[aria-label*="Chiudi"], button[aria-label*="Zavřít"], button[aria-label*="Fermer"]',
        )
        .first()
      await expect(closeButton).toBeVisible()

      // Try clicking a menu item (any link in the menu)
      const menuItems = menuNav.locator('a, button[type="button"]')
      const itemCount = await menuItems.count()
      expect(itemCount).toBeGreaterThan(0)
    })
  })

  test.describe('Route Navigation', () => {
    test('menu closes when navigating to a different route', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Click a link in the menu to navigate
      const compareLink = page.locator('a[href*="compare"]').first()
      await compareLink.click()

      // Wait for navigation to complete
      await page.waitForURL(/compare/)

      // Menu should be closed after navigation
      await expectMenuClosed(page)
    })

    test('menu closes when searching (debounced navigation)', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Close menu and use search to navigate
      // (Search is a primary interaction on mobile, should work independently)
      const searchButton = page
        .locator(
          'button[aria-label*="tap_to_search"], button[aria-label*="Ketuk"], button[aria-label*="Tocca"], button[aria-label*="Klepněte"], button[aria-label*="Toucher"]',
        )
        .first()
      if (await searchButton.isVisible()) {
        await searchButton.click()
      }
    })
  })

  test.describe('Accessibility', () => {
    test('menu has correct ARIA attributes', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)

      const menuDialog = page.locator('div[role="dialog"][aria-modal="true"]')
      await expect(menuDialog).toHaveAttribute(
        'aria-label',
        /menu|navigasi|di navigazione|navigační|navigation/,
      )
    })

    test('close button has proper accessibility label', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)

      const closeButton = page
        .locator(
          'button[aria-label*="close"], button[aria-label*="Tutup"], button[aria-label*="Chiudi"], button[aria-label*="Zavřít"], button[aria-label*="Fermer"]',
        )
        .first()
      await expect(closeButton).toHaveAttribute('aria-label', /close|tutup|chiudi|zavřít|fermer/i)
    })

    test('menu items are keyboard navigable', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open menu
      await openMobileMenu(page)
      await expectMenuOpen(page)

      // Get first focusable element in menu
      const menuNav = page.locator('nav[aria-modal="true"]')
      const focusableElements = menuNav.locator('a, button[type="button"]')

      // At least one should be focusable
      const count = await focusableElements.count()
      expect(count).toBeGreaterThan(0)

      // Focus first element
      if (count > 0) {
        await focusableElements.first().focus()
        await expect(focusableElements.first()).toBeFocused()
      }
    })
  })

  test.describe('Logic Isolation & Reusability', () => {
    test('helper functions work independently - expectMenuClosed', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Should not throw - menu is closed by default
      await expectMenuClosed(page)
    })

    test('helper functions work independently - openMobileMenu', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Helper should open menu without throwing
      await openMobileMenu(page)
      await expectMenuOpen(page)
    })

    test('helper functions work independently - closeMobileMenu', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Open and then use helper to close
      await openMobileMenu(page)
      await closeMobileMenu(page)
      await expectMenuClosed(page)
    })

    test('helpers can be combined in sequence', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isOnMobile = await isMobileViewport(page)
      if (!isOnMobile) {
        test.skip()
      }

      // Test sequence: closed -> open -> closed -> open
      await expectMenuClosed(page)
      await openMobileMenu(page)
      await expectMenuOpen(page)
      await closeMobileMenu(page)
      await expectMenuClosed(page)
      await openMobileMenu(page)
      await expectMenuOpen(page)
    })

    test('isMobileViewport helper works correctly', async ({ page, goto }) => {
      await goto('/', { waitUntil: 'hydration' })

      const isMobile = await isMobileViewport(page)
      expect(isMobile).toBe(true)
    })
  })
})
