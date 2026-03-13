import { test, expect } from '@playwright/test';

test.describe('Client name before project name', () => {
  const testPassword = 'Password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-brackets-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Brackets Tester');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard project dropdown shows client name before project', async ({ page }) => {
    await page.getByLabel('Select project').click();
    await expect(
      page.getByRole('option', { name: /acme corp.*brand refresh campaign/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole('option', { name: /globex industries.*mobile app mvp/i }),
    ).toBeVisible();
  });

  test('projects page cards show client name above project name', async ({ page }) => {
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects/);

    // Client and project names should be visible
    await expect(page.getByText('Brand Refresh Campaign')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Acme Corp')).toBeVisible();
    await expect(page.getByText('Globex Industries')).toBeVisible();
  });

  test('time logging dropdown shows client name before project', async ({ page }) => {
    await page.getByRole('button', { name: 'Time Logging' }).click();
    await expect(page).toHaveURL(/\/time-logging/);

    await page.getByLabel('Select project').click();
    await expect(
      page.getByRole('option', { name: /acme corp.*brand refresh campaign/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('weekly grid dropdown shows client name before project', async ({ page }) => {
    await page.getByRole('button', { name: 'Weekly Grid' }).click();
    await expect(page).toHaveURL(/\/weekly-grid/);

    await page.getByLabel('Add project').click();
    await expect(
      page.getByRole('option', { name: /acme corp.*brand refresh campaign/i }),
    ).toBeVisible({ timeout: 10000 });
  });
});
