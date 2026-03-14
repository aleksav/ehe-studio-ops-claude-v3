import { test, expect } from '@playwright/test';

test.describe('Responsive layout', () => {
  const testPassword = 'Password123';

  async function registerAndLogin(page: import('@playwright/test').Page, label: string) {
    const testEmail = `e2e-resp-${label}-${Date.now()}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Responsive Tester');
    await page.getByLabel('Email address').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  }

  test('mobile layout at 360px — sidebar is hidden, hamburger menu works', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
    });
    const page = await context.newPage();

    await registerAndLogin(page, '360');

    // Sidebar should NOT be visible (permanent drawer is hidden on mobile)
    await expect(page.locator('.MuiDrawer-docked')).not.toBeVisible();

    // Hamburger menu icon should be visible
    const menuButton = page.locator('button:has([data-testid="MenuIcon"])');
    await expect(menuButton).toBeVisible();

    // Click hamburger to open the temporary drawer
    await menuButton.click();

    // Sidebar nav items should now be visible inside the temporary drawer
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Time Logging')).toBeVisible();
    await expect(page.getByText('EHEStudio Ops')).toBeVisible();

    await context.close();
  });

  test('tablet layout at 768px — key elements are visible', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();

    await registerAndLogin(page, '768');

    // 768px is below MUI "md" breakpoint (900px) so this is mobile layout.
    // Verify welcome heading and user menu are visible before opening the drawer.
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();

    // Hamburger menu should be present (mobile layout)
    const menuButton = page.locator('button:has([data-testid="MenuIcon"])');
    await expect(menuButton).toBeVisible();

    // Open hamburger to verify nav items inside temporary drawer
    await menuButton.click();
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Admin')).toBeVisible();

    await context.close();
  });

  test('desktop layout at 1280px — permanent sidebar and full content visible', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await registerAndLogin(page, '1280');

    // Permanent sidebar should be visible (no hamburger menu)
    const menuButton = page.locator('button:has([data-testid="MenuIcon"])');
    await expect(menuButton).not.toBeVisible();

    // Sidebar nav items should be visible directly
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Projects' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Time Logging' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Standup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();

    // Dashboard heading and summary cards
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    await expect(page.getByText('Active Projects', { exact: true })).toBeVisible();
    await expect(page.getByText('Hours This Week', { exact: true })).toBeVisible();

    // User menu button
    await expect(page.locator('[data-testid="user-menu-button"]')).toBeVisible();

    await context.close();
  });
});
