import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-dash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Dashboard Tester');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard page loads with welcome message and summary cards', async ({ page }) => {
    // Welcome heading should include the user name
    await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();

    // Summary cards should be visible
    await expect(page.getByText('Active Projects')).toBeVisible();
    await expect(page.getByText('Hours This Week')).toBeVisible();
    await expect(page.getByText('Open Tasks')).toBeVisible();
  });

  test('project selector shows projects from seed data', async ({ page }) => {
    // The "Project Tasks" section heading should be visible
    await expect(page.getByRole('heading', { name: /project tasks/i })).toBeVisible();

    // Open the project selector
    await page.getByLabel('Select project').click();

    // Seed data has "Brand Refresh Campaign" and "Mobile App MVP"
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('option', { name: /mobile app mvp/i })).toBeVisible();
  });

  test('task cards display when a project is selected', async ({ page }) => {
    // Open the project selector and pick the first project
    await page.getByLabel('Select project').click();
    await page.getByRole('option').first().click();

    // Wait for tasks to load — seed data has tasks for both projects
    // Either task cards appear or "No tasks found" message appears
    const taskCardOrEmpty = page
      .getByRole('button', { name: /log time/i })
      .first()
      .or(page.getByText(/no tasks found/i));

    await expect(taskCardOrEmpty).toBeVisible({ timeout: 10000 });
  });

  test('task cards show Log Time button for seed project with tasks', async ({ page }) => {
    // Select "Brand Refresh Campaign" which has tasks in seed data
    await page.getByLabel('Select project').click();
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();

    // Wait for task cards to load — should see at least one "Log Time" button
    await expect(page.getByRole('button', { name: /log time/i }).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify a known seed task description is visible
    await expect(page.getByText('Conduct competitor analysis')).toBeVisible();
  });

  test('navigation sidebar shows all expected links', async ({ page }) => {
    await expect(page.getByText('Dashboard')).toBeVisible();
    await expect(page.getByText('Projects')).toBeVisible();
    await expect(page.getByText('Team')).toBeVisible();
    await expect(page.getByText('Time Logging')).toBeVisible();
    await expect(page.getByText('Weekly Grid')).toBeVisible();
    await expect(page.getByText('Standup')).toBeVisible();
  });
});
