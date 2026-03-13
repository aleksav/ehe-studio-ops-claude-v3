import { test, expect } from '@playwright/test';

test.describe('Clients', () => {
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Client Tester');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Clients via sidebar
    await page.getByRole('button', { name: 'Clients' }).click();
    await expect(page).toHaveURL(/\/clients/);
  });

  test('page loads with heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
  });

  test('shows seed clients', async ({ page }) => {
    await expect(page.getByText('Acme Corp')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Globex Industries')).toBeVisible();
  });

  test('can create a new client', async ({ page }) => {
    const uniqueName = `Test Client ${Date.now()}`;

    // Click New Client button
    await page.getByRole('button', { name: /new client/i }).click();

    // Fill in the form
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Client Name').fill(uniqueName);
    await page.getByLabel('Contact Name').fill('John Doe');
    await page.getByLabel('Contact Email').fill('john@testclient.com');

    // Submit
    await page.getByRole('button', { name: /create client/i }).click();

    // Should show success snackbar
    await expect(page.getByText(/client created/i)).toBeVisible({ timeout: 10000 });

    // New client should appear in the list
    await expect(page.getByText(uniqueName)).toBeVisible();
  });

  test('can edit a client', async ({ page }) => {
    // Wait for clients to load
    await expect(page.getByText('Acme Corp')).toBeVisible({ timeout: 10000 });

    // Click the edit button for the first client
    await page.getByRole('button', { name: /edit/i }).first().click();

    // Dialog should open with pre-filled values
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Client Name')).toHaveValue(/./);

    // Change the contact name
    await page.getByLabel('Contact Name').clear();
    await page.getByLabel('Contact Name').fill('Updated Contact');

    // Save
    await page.getByRole('button', { name: /save changes/i }).click();

    // Should show success snackbar
    await expect(page.getByText(/client updated/i)).toBeVisible({ timeout: 10000 });
  });

  test('projects page shows client name with project name', async ({ page }) => {
    // Navigate to Projects
    await page.getByRole('button', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects/);

    // Should see client name displayed with project
    await expect(page.getByText('Acme Corp')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Brand Refresh Campaign')).toBeVisible();
  });
});
