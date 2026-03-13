import { test, expect } from '@playwright/test';

test.describe('Time Logging — Quick Entry', () => {
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-time-${Date.now()}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Time Logger');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to time logging
    await page.getByText('Time Logging').click();
    await expect(page).toHaveURL(/\/time-logging/);
  });

  test('log time for a project with quick entry', async ({ page }) => {
    // Select a project
    await page.getByLabel('Select project').click();
    await page.getByRole('option').first().click();

    // Fill hours
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('4');

    // Select task type
    await page.getByLabel('Task type').click();
    await page.getByRole('option').first().click();

    // Submit
    await page.getByRole('button', { name: /log entry/i }).click();

    // Should see success or entry in list
    await page.waitForTimeout(1500);

    // Verify entry appears — check the project total chip
    await expect(page.getByText('4.0h total')).toBeVisible({ timeout: 5000 });
  });

  test('shows warning when daily total exceeds 8h', async ({ page }) => {
    // Select a project
    await page.getByLabel('Select project').click();
    await page.getByRole('option').first().click();

    // Log 5 hours first
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('5');
    await page.getByLabel('Task type').click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1000);

    // Log 4 more hours (total 9h > 8h)
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('4');
    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1000);

    // Should see warning
    await expect(page.getByText(/exceeds 8h|warning/i)).toBeVisible({ timeout: 5000 });
  });

  test('submission is blocked when daily total reaches 12h', async ({ page }) => {
    // Select a project
    await page.getByLabel('Select project').click();
    await page.getByRole('option').first().click();

    // Log 8 hours first
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('8');
    await page.getByLabel('Task type').click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1500);

    // Log 4 more hours (total 12h = blocked)
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('4');
    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1500);

    // Should see a blocking error mentioning daily hours exceeded or maximum 12h
    await expect(page.getByText(/DAILY_HOURS_EXCEEDED|maximum 12h/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
