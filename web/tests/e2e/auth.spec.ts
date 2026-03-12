import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  const testEmail = `e2e-${Date.now()}@test.com`;
  const testPassword = 'password123';
  const testName = 'E2E Test User';

  test('register and land on dashboard', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

    await page.getByLabel('Full Name').fill(testName);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(testName, { exact: false })).toBeVisible();
  });

  test('logout and login again', async ({ page }) => {
    // Register first
    await page.goto('/register');
    const email = `e2e-logout-${Date.now()}@test.com`;
    await page.getByLabel('Full Name').fill('Logout Test');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Logout via user menu
    await page.locator('[data-testid="user-menu-button"]').click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();

    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('redirect to login when not authenticated', async ({ page }) => {
    // Clear any stored tokens
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
