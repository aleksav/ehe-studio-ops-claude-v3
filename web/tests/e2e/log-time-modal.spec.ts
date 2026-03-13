import { test, expect } from '@playwright/test';

test.describe('Log Time Modal', () => {
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-modal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Modal Tester');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Select a project with tasks so Log Time buttons appear
    await page.getByLabel('Select project').click();
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();

    // Wait for task cards with Log Time buttons
    await expect(page.getByRole('button', { name: /log time/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('opens Log Time modal from task card button', async ({ page }) => {
    // Click the first Log Time button on a task card
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Modal dialog should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Should show "Log Time" heading inside the dialog
    await expect(page.getByRole('dialog').getByText('Log Time')).toBeVisible();

    // Should show the project name (with client prefix) inside the dialog
    await expect(page.getByRole('dialog').getByText(/Brand Refresh Campaign/)).toBeVisible();
  });

  test('modal shows form fields: team member, date, hours, task type', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Team Member selector
    await expect(page.getByLabel('Team Member')).toBeVisible();

    // Date field
    await expect(page.getByLabel('Date')).toBeVisible();

    // Hours field
    await expect(page.getByLabel('Hours')).toBeVisible();

    // Task Type selector
    await expect(page.getByLabel('Task Type')).toBeVisible();

    // Notes field
    await expect(page.getByLabel(/notes/i)).toBeVisible();

    // Submit and Cancel buttons
    await expect(page.getByRole('button', { name: /log entry/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  test('team member selector shows seed team members', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Open team member dropdown
    await page.getByLabel('Team Member').click();

    // Seed data has Alice Chen, Bob Martinez, Carol Wright
    await expect(page.getByRole('option', { name: /alice chen/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('option', { name: /bob martinez/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /carol wright/i })).toBeVisible();
  });

  test('selecting a team member pre-fills task type from preferred_task_type', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Select Alice Chen (preferred_task_type = DEVELOPMENT_TESTING)
    await page.getByLabel('Team Member').click();
    await expect(page.getByRole('option', { name: /alice chen/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('option', { name: /alice chen/i }).click();

    // Task Type should be pre-filled with "Development & Testing"
    await expect(page.getByText('Development & Testing')).toBeVisible({
      timeout: 5000,
    });
  });

  test('modal closes when Cancel is clicked', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: /log time/i })).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal should no longer be visible
    await expect(page.getByRole('heading', { name: /log time/i })).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('submits time entry successfully and shows snackbar', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Select team member
    await page.getByLabel('Team Member').click();
    await expect(page.getByRole('option', { name: /alice chen/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('option', { name: /alice chen/i }).click();

    // Fill hours
    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('2');

    // Task type should already be pre-filled from Alice's preferred type
    // but verify it's set (Development & Testing)
    await expect(page.getByText('Development & Testing')).toBeVisible();

    // Submit
    await page.getByRole('button', { name: /log entry/i }).click();

    // Should see success snackbar
    await expect(page.getByText(/logged successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // Modal should close after successful submission
    await expect(page.getByRole('heading', { name: /log time/i })).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('Log Entry button is disabled when required fields are empty', async ({ page }) => {
    await page
      .getByRole('button', { name: /log time/i })
      .first()
      .click();

    // Without filling any fields, Log Entry should be disabled
    await expect(page.getByRole('button', { name: /log entry/i })).toBeDisabled();
  });
});
