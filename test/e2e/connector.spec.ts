/**
 * E2E tests for connector-authenticated features.
 *
 * These tests use a mock connector server (started in global setup)
 * to test features that require being logged in via the connector.
 */

import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'

/**
 * When connected, the header shows "packages" and "orgs" links scoped to the user.
 * This helper waits for the packages link to appear as proof of successful connection.
 */
async function expectConnected(page: Page, username = 'testuser') {
  await expect(page.locator(`a[href="/~${username}"]`, { hasText: 'packages' })).toBeVisible({
    timeout: 10_000,
  })
}

/**
 * Open the connector modal by clicking the account menu button, then clicking
 * the npm CLI menu item inside the dropdown.
 */
async function openConnectorModal(page: Page) {
  // The AccountMenu button has aria-haspopup="true"
  await page.locator('button[aria-haspopup="true"]').click()

  // In the dropdown menu, click the npm CLI item (menuitem containing ~testuser)
  await page
    .getByRole('menuitem')
    .filter({ hasText: /~testuser/ })
    .click()

  // Wait for the dialog to appear
  await expect(page.getByRole('dialog')).toBeVisible()
}

test.describe('Connector Connection', () => {
  test('connects via URL params and shows connected state', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    await mockConnector.setUserOrgs(['@testorg'])
    await gotoConnected('/')

    // Header should show "packages" link for the connected user
    await expectConnected(page)
  })

  test('opens connector modal and shows connected user', async ({ page, gotoConnected }) => {
    await gotoConnected('/')
    await expectConnected(page)

    await openConnectorModal(page)

    // The modal should show the connected user
    await expect(page.getByRole('dialog')).toContainText('testuser')
  })

  test('can disconnect from the connector', async ({ page, gotoConnected }) => {
    await gotoConnected('/')
    await expectConnected(page)

    await openConnectorModal(page)

    const modal = page.getByRole('dialog')

    // Click disconnect button
    await modal.getByRole('button', { name: /disconnect/i }).click()

    // Close the modal
    await modal.getByRole('button', { name: /close/i }).click()

    // The "packages" link should disappear since we're disconnected
    await expect(page.locator('a[href="/~testuser"]', { hasText: 'packages' })).not.toBeVisible({
      timeout: 5000,
    })

    // The account menu button should now show "connect" text (the main button, not dropdown items)
    await expect(page.getByRole('button', { name: 'connect', exact: true })).toBeVisible()
  })
})

test.describe('Organization Management', () => {
  test.beforeEach(async ({ mockConnector }) => {
    await mockConnector.setOrgData('@testorg', {
      users: {
        testuser: 'owner',
        member1: 'admin',
        member2: 'developer',
      },
      teams: ['core', 'docs'],
      teamMembers: {
        core: ['testuser', 'member1'],
        docs: ['member2'],
      },
    })
    await mockConnector.setUserOrgs(['@testorg'])
  })

  test('shows org members when connected', async ({ page, gotoConnected }) => {
    await gotoConnected('/@testorg')

    // The org management region contains the members panel
    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    // Should show the members list
    const membersList = page.getByRole('list', { name: /organization members/i })
    await expect(membersList).toBeVisible({ timeout: 10_000 })

    // Members are shown as ~username links
    await expect(membersList.getByRole('link', { name: '~testuser' })).toBeVisible()
    await expect(membersList.getByRole('link', { name: '~member1' })).toBeVisible()
    await expect(membersList.getByRole('link', { name: '~member2' })).toBeVisible()
  })

  test('can filter members by role', async ({ page, gotoConnected }) => {
    await gotoConnected('/@testorg')

    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    const membersList = page.getByRole('list', { name: /organization members/i })
    await expect(membersList).toBeVisible({ timeout: 10_000 })

    // Click the "admin" filter button (inside "Filter by role" group)
    await orgManagement
      .getByRole('group', { name: /filter by role/i })
      .getByRole('button', { name: /admin/i })
      .click()

    // Should only show admin member
    await expect(membersList.getByRole('link', { name: '~member1' })).toBeVisible()
    await expect(membersList.getByRole('link', { name: '~testuser' })).not.toBeVisible()
    await expect(membersList.getByRole('link', { name: '~member2' })).not.toBeVisible()
  })

  test('can search members by name', async ({ page, gotoConnected }) => {
    await gotoConnected('/@testorg')

    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    const membersList = page.getByRole('list', { name: /organization members/i })
    await expect(membersList).toBeVisible({ timeout: 10_000 })

    const searchInput = orgManagement.getByRole('searchbox', { name: /filter members/i })
    await searchInput.fill('member1')

    // Should only show matching member
    await expect(membersList.getByRole('link', { name: '~member1' })).toBeVisible()
    await expect(membersList.getByRole('link', { name: '~testuser' })).not.toBeVisible()
    await expect(membersList.getByRole('link', { name: '~member2' })).not.toBeVisible()
  })

  test('can add a new member operation', async ({ page, gotoConnected, mockConnector }) => {
    await gotoConnected('/@testorg')

    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    // Click "Add member" button
    await orgManagement.getByRole('button', { name: /add member/i }).click()

    // Fill in the form
    const usernameInput = orgManagement.locator('input[name="new-member-username"]')
    await usernameInput.fill('newuser')

    // Select role
    await orgManagement.locator('select[name="new-member-role"]').selectOption('admin')

    // Submit
    await orgManagement.getByRole('button', { name: /^add$/i }).click()
    await page.waitForTimeout(500)

    // Verify operation
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:add-user')
    expect(operations[0]?.params.user).toBe('newuser')
    expect(operations[0]?.params.role).toBe('admin')
  })

  test('can remove a member (adds operation)', async ({ page, gotoConnected, mockConnector }) => {
    await gotoConnected('/@testorg')

    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    await orgManagement.getByRole('button', { name: /remove member2/i }).click()
    await page.waitForTimeout(500)

    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:rm-user')
    expect(operations[0]?.params.user).toBe('member2')
  })

  test('can change member role (adds operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    await gotoConnected('/@testorg')

    const orgManagement = page.getByRole('region', { name: /organization management/i })
    await expect(orgManagement).toBeVisible({ timeout: 10_000 })

    const roleSelect = orgManagement.locator('select[name="role-member2"]')
    await expect(roleSelect).toBeVisible({ timeout: 5000 })
    await roleSelect.selectOption('admin')
    await page.waitForTimeout(500)

    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:add-user')
    expect(operations[0]?.params.user).toBe('member2')
    expect(operations[0]?.params.role).toBe('admin')
  })
})

test.describe('Package Access Controls', () => {
  test.beforeEach(async ({ mockConnector }) => {
    await mockConnector.setOrgData('@nuxt', {
      users: { testuser: 'owner' },
      teams: ['core', 'docs', 'triage'],
    })
    await mockConnector.setUserOrgs(['@nuxt'])
    await mockConnector.setPackageData('@nuxt/kit', {
      collaborators: {
        'nuxt:core': 'read-write',
        'nuxt:docs': 'read-only',
      },
    })
  })

  /**
   * Helper: connect on home page then navigate to the package page.
   * Verifies connection is established before navigating.
   */
  async function goToPackageConnected(page: Page, gotoConnected: (path: string) => Promise<void>) {
    await gotoConnected('/')
    await expectConnected(page)
    await page.goto('/package/@nuxt/kit')
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30_000 })
  }

  /** The access section is identified by the "Team Access" heading */
  function accessSection(page: Page) {
    return page.locator('section:has(#access-heading)')
  }

  test('shows team access section on scoped package when connected', async ({
    page,
    gotoConnected,
  }) => {
    await goToPackageConnected(page, gotoConnected)

    await expect(accessSection(page)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /team access/i })).toBeVisible()
  })

  test('displays collaborators with correct permissions', async ({ page, gotoConnected }) => {
    await goToPackageConnected(page, gotoConnected)

    await expect(accessSection(page)).toBeVisible({ timeout: 15_000 })

    const teamList = page.getByRole('list', { name: /team access list/i })
    await expect(teamList).toBeVisible({ timeout: 10_000 })

    await expect(teamList.getByText('core')).toBeVisible()
    await expect(teamList.locator('span', { hasText: 'rw' })).toBeVisible()
    await expect(teamList.getByText('docs')).toBeVisible()
    await expect(teamList.locator('span', { hasText: 'ro' })).toBeVisible()
  })

  test('can grant team access (creates operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    await goToPackageConnected(page, gotoConnected)

    const section = accessSection(page)
    await expect(section).toBeVisible({ timeout: 15_000 })

    await section.getByRole('button', { name: /grant team access/i }).click()

    const teamSelect = section.locator('select[name="grant-team"]')
    await expect(teamSelect).toBeVisible()
    await expect(teamSelect.locator('option')).toHaveCount(4, { timeout: 10_000 })
    await teamSelect.selectOption({ label: 'nuxt:triage' })

    const permissionSelect = section.locator('select[name="grant-permission"]')
    await permissionSelect.selectOption('read-write')

    await section.getByRole('button', { name: /^grant$/i }).click()
    await page.waitForTimeout(500)

    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('access:grant')
    expect(operations[0]?.params.scopeTeam).toBe('@nuxt:triage')
    expect(operations[0]?.params.pkg).toBe('@nuxt/kit')
    expect(operations[0]?.params.permission).toBe('read-write')
  })

  test('can revoke team access (creates operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    await goToPackageConnected(page, gotoConnected)

    const section = accessSection(page)
    await expect(section).toBeVisible({ timeout: 15_000 })

    const teamList = page.getByRole('list', { name: /team access list/i })
    await expect(teamList).toBeVisible({ timeout: 10_000 })

    await section.getByRole('button', { name: /revoke docs access/i }).click()
    await page.waitForTimeout(500)

    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('access:revoke')
    expect(operations[0]?.params.scopeTeam).toBe('nuxt:docs')
    expect(operations[0]?.params.pkg).toBe('@nuxt/kit')
  })

  test('can cancel grant access form', async ({ page, gotoConnected }) => {
    await goToPackageConnected(page, gotoConnected)

    const section = accessSection(page)
    await expect(section).toBeVisible({ timeout: 15_000 })

    await section.getByRole('button', { name: /grant team access/i }).click()
    const teamSelect = section.locator('select[name="grant-team"]')
    await expect(teamSelect).toBeVisible()

    await section.getByRole('button', { name: /cancel granting access/i }).click()
    await expect(teamSelect).not.toBeVisible()
    await expect(section.getByRole('button', { name: /grant team access/i })).toBeVisible()
  })
})

test.describe('Operations Queue', () => {
  test('shows operations in connector modal', async ({ page, gotoConnected, mockConnector }) => {
    await mockConnector.addOperation({
      type: 'org:add-user',
      params: { org: '@testorg', user: 'newuser', role: 'developer' },
      description: 'Add @newuser to @testorg as developer',
      command: 'npm org set @testorg newuser developer',
    })
    await mockConnector.addOperation({
      type: 'org:rm-user',
      params: { org: '@testorg', user: 'olduser' },
      description: 'Remove @olduser from @testorg',
      command: 'npm org rm @testorg olduser',
    })

    await gotoConnected('/')
    await expectConnected(page)

    await openConnectorModal(page)

    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('Add @newuser')
    await expect(modal).toContainText('Remove @olduser')
  })

  test('can approve and execute operations', async ({ page, gotoConnected, mockConnector }) => {
    await mockConnector.addOperation({
      type: 'org:add-user',
      params: { org: '@testorg', user: 'newuser', role: 'developer' },
      description: 'Add @newuser to @testorg',
      command: 'npm org set @testorg newuser developer',
    })

    await gotoConnected('/')
    await expectConnected(page)

    await openConnectorModal(page)

    const modal = page.getByRole('dialog')

    // Approve all
    const approveAllBtn = modal.getByRole('button', { name: /approve all/i })
    await expect(approveAllBtn).toBeVisible({ timeout: 5000 })
    await approveAllBtn.click()
    await page.waitForTimeout(300)

    let operations = await mockConnector.getOperations()
    expect(operations[0]?.status).toBe('approved')

    // Execute
    const executeBtn = modal.getByRole('button', { name: /execute/i })
    await expect(executeBtn).toBeVisible({ timeout: 5000 })
    await executeBtn.click()
    await page.waitForTimeout(500)

    operations = await mockConnector.getOperations()
    expect(operations[0]?.status).toBe('completed')
  })

  test('can clear pending operations', async ({ page, gotoConnected, mockConnector }) => {
    await mockConnector.addOperation({
      type: 'org:add-user',
      params: { org: '@testorg', user: 'newuser', role: 'developer' },
      description: 'Add @newuser to @testorg',
      command: 'npm org set @testorg newuser developer',
    })

    await gotoConnected('/')
    await expectConnected(page)

    await openConnectorModal(page)

    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: /clear/i }).click()

    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(0)
  })
})
