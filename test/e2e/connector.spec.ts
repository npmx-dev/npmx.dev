/**
 * E2E tests for connector-authenticated features.
 *
 * These tests use a mock connector server (started in global setup)
 * to test features that require being logged in via the connector.
 */

import { test, expect } from './helpers/fixtures'

test.describe('Connector Connection', () => {
  test('connects via URL params and shows connected state', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    // Set up mock state
    await mockConnector.setUserOrgs(['@testorg'])

    // Navigate with credentials in URL params
    await gotoConnected('/')

    // Should show connected indicator
    // The connector status shows a green dot or avatar when connected
    // Look for the username link that appears when connected
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })
  })

  test('shows tooltip when hovering connector status', async ({ page, gotoConnected }) => {
    await gotoConnected('/')

    // Hover over the connector button (look for the button with aria-label containing "connected")
    const connectorButton = page.getByRole('button', { name: /connected/i })
    await connectorButton.hover()

    // Should show tooltip
    await expect(page.getByRole('tooltip')).toContainText(/connected/i)
  })

  test('opens connector modal when clicking status button', async ({ page, gotoConnected }) => {
    await gotoConnected('/')

    // Click the connector status button
    await page.getByRole('button', { name: /connected/i }).click()

    // Should open the connector modal
    // The modal should show the connected user
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('testuser')
  })

  test('can disconnect from the connector', async ({ page, gotoConnected }) => {
    await gotoConnected('/')

    // Open connector modal
    await page.getByRole('button', { name: /connected/i }).click()

    // Should show modal with disconnect button
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Click disconnect button
    await modal.getByRole('button', { name: /disconnect/i }).click()

    // Modal shows the disconnected state - close it manually
    await modal.getByRole('button', { name: /close/i }).click()

    // Should show "click to connect" state - the button aria-label changes
    await expect(page.getByRole('button', { name: /click to connect/i })).toBeVisible({
      timeout: 5000,
    })
  })
})

test.describe('Organization Management', () => {
  test.beforeEach(async ({ mockConnector }) => {
    // Set up mock org data
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
    // Navigate to org page with connection
    await gotoConnected('/@testorg')

    // Should show the members panel
    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible({ timeout: 10000 })

    // Should show all members
    await expect(membersSection.getByRole('link', { name: '@testuser' })).toBeVisible({
      timeout: 10000,
    })
    await expect(membersSection.getByRole('link', { name: '@member1' })).toBeVisible()
    await expect(membersSection.getByRole('link', { name: '@member2' })).toBeVisible()

    // Should show role badges (the actual badges, not filter buttons or options)
    await expect(membersSection.locator('span.px-1\\.5', { hasText: 'owner' })).toBeVisible()
    await expect(membersSection.locator('span.px-1\\.5', { hasText: 'admin' })).toBeVisible()
    await expect(membersSection.locator('span.px-1\\.5', { hasText: 'developer' })).toBeVisible()
  })

  test('can filter members by role', async ({ page, gotoConnected }) => {
    await gotoConnected('/@testorg')

    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible()

    // Click the "admin" filter button
    await membersSection.getByRole('button', { name: /admin/i }).click()

    // Should only show admin member
    await expect(membersSection.getByRole('link', { name: '@member1' })).toBeVisible()
    await expect(membersSection.getByRole('link', { name: '@testuser' })).not.toBeVisible()
    await expect(membersSection.getByRole('link', { name: '@member2' })).not.toBeVisible()
  })

  test('can search members by name', async ({ page, gotoConnected }) => {
    await gotoConnected('/@testorg')

    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible()

    // Type in the search input
    const searchInput = membersSection.getByRole('searchbox')
    await searchInput.fill('member1')

    // Should only show matching member
    await expect(membersSection.getByRole('link', { name: '@member1' })).toBeVisible()
    await expect(membersSection.getByRole('link', { name: '@testuser' })).not.toBeVisible()
    await expect(membersSection.getByRole('link', { name: '@member2' })).not.toBeVisible()
  })

  test('can add a new member operation', async ({ page, gotoConnected, mockConnector }) => {
    await gotoConnected('/@testorg')

    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible({ timeout: 10000 })

    // Click "Add member" button (text is "+ Add member")
    await membersSection.getByRole('button', { name: /add member/i }).click()

    // Fill in the form - use the input's name attribute
    const usernameInput = membersSection.locator('input[name="new-member-username"]')
    await usernameInput.fill('newuser')

    // Select role (admin)
    await membersSection.locator('select[name="new-member-role"]').selectOption('admin')

    // Submit the form - button text is "add"
    await membersSection.getByRole('button', { name: /^add$/i }).click()

    // Wait a moment for the operation to be added
    await page.waitForTimeout(500)

    // Should have added an operation
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:add-user')
    // Note: The app may strip the @ prefix from org names
    expect(operations[0]?.params.user).toBe('newuser')
    expect(operations[0]?.params.role).toBe('admin')
  })

  test('can remove a member (adds operation)', async ({ page, gotoConnected, mockConnector }) => {
    await gotoConnected('/@testorg')

    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible({ timeout: 10000 })

    // Find the remove button for member2 - aria-label is "Remove member2 from org"
    await membersSection.getByRole('button', { name: /remove member2/i }).click()

    // Wait a moment for the operation to be added
    await page.waitForTimeout(500)

    // Should have added a remove operation
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:rm-user')
    // Note: The app may strip the @ prefix from org names
    expect(operations[0]?.params.user).toBe('member2')
  })

  test('can change member role (adds operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    await gotoConnected('/@testorg')

    const membersSection = page.locator('section[aria-labelledby="members-heading"]')
    await expect(membersSection).toBeVisible({ timeout: 10000 })

    // Find the role selector for member2 and change it
    const roleSelect = membersSection.locator('select[name="role-member2"]')
    await expect(roleSelect).toBeVisible({ timeout: 5000 })
    await roleSelect.selectOption('admin')

    // Wait a moment for the operation to be added
    await page.waitForTimeout(500)

    // Should have added a change role operation
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('org:add-user') // npm org set uses same command
    // Note: The app may strip the @ prefix from org names
    expect(operations[0]?.params.user).toBe('member2')
    expect(operations[0]?.params.role).toBe('admin')
  })
})

test.describe('Package Access Controls', () => {
  test.beforeEach(async ({ mockConnector }) => {
    // Set up org with teams (required for the team access dropdown)
    await mockConnector.setOrgData('@nuxt', {
      users: {
        testuser: 'owner',
      },
      teams: ['core', 'docs', 'triage'],
    })
    await mockConnector.setUserOrgs(['@nuxt'])

    // Set up package collaborators - teams use "scope:team" format
    await mockConnector.setPackageData('@nuxt/kit', {
      collaborators: {
        'nuxt:core': 'read-write',
        'nuxt:docs': 'read-only',
      },
    })
  })

  test('shows team access section on scoped package when connected', async ({
    page,
    gotoConnected,
  }) => {
    // First navigate to home to verify connector is working
    await gotoConnected('/')
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })

    // Now navigate to the package page
    await page.goto('/package/@nuxt/kit')

    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30000 })

    // Verify we're still connected
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 5000 })

    // Should show the team access section
    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).toBeVisible({ timeout: 15000 })

    // Should show the title
    await expect(accessSection.getByRole('heading', { name: /team access/i })).toBeVisible()
  })

  test('displays collaborators with correct permissions', async ({ page, gotoConnected }) => {
    // Connect on home first, then navigate to package
    await gotoConnected('/')
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })
    await page.goto('/package/@nuxt/kit')
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30000 })

    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).toBeVisible({ timeout: 15000 })

    // Wait for collaborators to load
    const collaboratorsList = accessSection.getByRole('list', { name: /team access list/i })
    await expect(collaboratorsList).toBeVisible({ timeout: 10000 })

    // Should show core team with read-write (rw)
    await expect(collaboratorsList.getByText('core')).toBeVisible()
    await expect(collaboratorsList.locator('span', { hasText: 'rw' })).toBeVisible()

    // Should show docs team with read-only (ro)
    await expect(collaboratorsList.getByText('docs')).toBeVisible()
    await expect(collaboratorsList.locator('span', { hasText: 'ro' })).toBeVisible()
  })

  test('can grant team access (creates operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    // Connect on home first, then navigate to package
    await gotoConnected('/')
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })
    await page.goto('/package/@nuxt/kit')
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30000 })

    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).toBeVisible({ timeout: 15000 })

    // Click "Grant team access" button
    await accessSection.getByRole('button', { name: /grant team access/i }).click()

    // Select a team from dropdown
    const teamSelect = accessSection.locator('select[name="grant-team"]')
    await expect(teamSelect).toBeVisible()

    // Wait for teams to load (options will appear)
    await expect(teamSelect.locator('option')).toHaveCount(4, { timeout: 10000 }) // 1 placeholder + 3 teams

    await teamSelect.selectOption({ label: 'nuxt:triage' })

    // Select permission level
    const permissionSelect = accessSection.locator('select[name="grant-permission"]')
    await permissionSelect.selectOption('read-write')

    // Click grant button
    await accessSection.getByRole('button', { name: /^grant$/i }).click()

    // Wait for operation to be added
    await page.waitForTimeout(500)

    // Verify operation was added
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('access:grant')
    // scopeTeam includes @ prefix (from buildScopeTeam utility)
    expect(operations[0]?.params.scopeTeam).toBe('@nuxt:triage')
    expect(operations[0]?.params.pkg).toBe('@nuxt/kit')
    expect(operations[0]?.params.permission).toBe('read-write')
  })

  test('can revoke team access (creates operation)', async ({
    page,
    gotoConnected,
    mockConnector,
  }) => {
    // Connect on home first, then navigate to package
    await gotoConnected('/')
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })
    await page.goto('/package/@nuxt/kit')
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30000 })

    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).toBeVisible({ timeout: 15000 })

    // Wait for collaborators to load
    const collaboratorsList = accessSection.getByRole('list', { name: /team access list/i })
    await expect(collaboratorsList).toBeVisible({ timeout: 10000 })

    // Click revoke button for docs team - aria-label is "Revoke docs access"
    await accessSection.getByRole('button', { name: /revoke docs access/i }).click()

    // Wait for operation to be added
    await page.waitForTimeout(500)

    // Verify operation was added
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]?.type).toBe('access:revoke')
    expect(operations[0]?.params.scopeTeam).toBe('nuxt:docs')
    expect(operations[0]?.params.pkg).toBe('@nuxt/kit')
  })

  test('does not show access section on unscoped packages', async ({ page, gotoConnected }) => {
    // Navigate to an unscoped package
    await gotoConnected('/package/lodash')

    // The access section should not be visible (component only shows for scoped packages)
    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).not.toBeVisible()
  })

  test('can cancel grant access form', async ({ page, gotoConnected }) => {
    // Connect on home first, then navigate to package
    await gotoConnected('/')
    await expect(page.getByRole('link', { name: '@testuser' })).toBeVisible({ timeout: 10000 })
    await page.goto('/package/@nuxt/kit')
    await expect(page.locator('h1')).toContainText('kit', { timeout: 30000 })

    const accessSection = page.locator('section[aria-labelledby="access-heading"]')
    await expect(accessSection).toBeVisible({ timeout: 15000 })

    // Open grant access form
    await accessSection.getByRole('button', { name: /grant team access/i }).click()

    // Form should be visible
    const teamSelect = accessSection.locator('select[name="grant-team"]')
    await expect(teamSelect).toBeVisible()

    // Click cancel button
    await accessSection.getByRole('button', { name: /cancel granting access/i }).click()

    // Form should be hidden, grant button should be back
    await expect(teamSelect).not.toBeVisible()
    await expect(accessSection.getByRole('button', { name: /grant team access/i })).toBeVisible()
  })
})

test.describe('Operations Queue', () => {
  test('shows operations in connector modal', async ({ page, gotoConnected, mockConnector }) => {
    // Add some operations
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

    // Should show operation count badge
    const badge = page.locator('span:has-text("2")').first()
    await expect(badge).toBeVisible()

    // Open connector modal
    await page.getByRole('button', { name: /connected/i }).click()
    const modal = page.getByRole('dialog')

    // Should show both operations
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

    // Open connector modal
    await page.getByRole('button', { name: /connected/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // Click "Approve all" - wait for it to be visible first
    const approveAllBtn = modal.getByRole('button', { name: /approve all/i })
    await expect(approveAllBtn).toBeVisible({ timeout: 5000 })
    await approveAllBtn.click()

    // Wait for the state to update
    await page.waitForTimeout(300)

    // Verify operation is approved
    let operations = await mockConnector.getOperations()
    expect(operations[0]?.status).toBe('approved')

    // Click "Execute" - wait for it to be visible first
    const executeBtn = modal.getByRole('button', { name: /execute/i })
    await expect(executeBtn).toBeVisible({ timeout: 5000 })
    await executeBtn.click()

    // Wait for execution to complete
    await page.waitForTimeout(500)

    // Verify operation is completed
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

    // Open connector modal
    await page.getByRole('button', { name: /connected/i }).click()
    const modal = page.getByRole('dialog')

    // Click "Clear all"
    await modal.getByRole('button', { name: /clear/i }).click()

    // Verify operations are cleared
    const operations = await mockConnector.getOperations()
    expect(operations).toHaveLength(0)
  })
})
