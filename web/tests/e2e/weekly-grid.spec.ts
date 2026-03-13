import { test, expect } from '@playwright/test';

test.describe('Weekly Grid', () => {
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    const testEmail = `e2e-grid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@ehe.ai`;
    await page.goto('/register');
    await page.getByLabel('Full Name').fill('Grid Tester');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Weekly Grid via sidebar
    await page.getByText('Weekly Grid').click();
    await expect(page).toHaveURL(/\/weekly-grid/);
  });

  test('page loads with heading and week label', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /weekly grid/i })).toBeVisible();

    // Should show "Week of <date>" label
    await expect(page.getByText(/week of/i)).toBeVisible();

    // Should show "This Week" button
    await expect(page.getByRole('button', { name: /this week/i })).toBeVisible();
  });

  test('shows empty state when no project rows are added', async ({ page }) => {
    // Clear any localStorage project rows to ensure clean state
    await page.evaluate(() => {
      localStorage.removeItem('weeklyGrid:projectRows');
      localStorage.removeItem('weeklyGrid:taskTypes');
    });
    await page.reload();
    await expect(page).toHaveURL(/\/weekly-grid/);

    // Should show empty state message
    await expect(page.getByText(/add a project above to start logging time/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('add project dropdown shows seed projects', async ({ page }) => {
    // Open the "Add project" selector
    await page.getByLabel('Add project').click();

    // Seed data has "Brand Refresh Campaign" and "Mobile App MVP"
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('option', { name: /mobile app mvp/i })).toBeVisible();
  });

  test('can add a project row to the grid', async ({ page }) => {
    // Clear localStorage to start fresh
    await page.evaluate(() => {
      localStorage.removeItem('weeklyGrid:projectRows');
      localStorage.removeItem('weeklyGrid:taskTypes');
    });
    await page.reload();
    await expect(page).toHaveURL(/\/weekly-grid/);

    // Select a project from the dropdown
    await page.getByLabel('Add project').click();
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();

    // Click Add button
    await page.getByRole('button', { name: /^add$/i }).click();

    // Project name should now appear in the grid table
    await expect(page.getByText('Brand Refresh Campaign')).toBeVisible({
      timeout: 10000,
    });

    // Grid table should be visible with day columns
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Tue')).toBeVisible();
    await expect(page.getByText('Wed')).toBeVisible();
    await expect(page.getByText('Thu')).toBeVisible();
    await expect(page.getByText('Fri')).toBeVisible();
    await expect(page.getByText('Sat')).toBeVisible();
    await expect(page.getByText('Sun')).toBeVisible();
  });

  test('grid shows 7 day columns (Mon-Sun) and Daily Total row', async ({ page }) => {
    // Add a project so the grid table renders
    await page.getByLabel('Add project').click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /^add$/i }).click();

    // Check all day column headers
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      await expect(page.getByText(day)).toBeVisible({ timeout: 10000 });
    }

    // "Project" column header
    await expect(page.getByRole('columnheader', { name: 'Project' })).toBeVisible();

    // "Total" column header
    await expect(page.getByRole('columnheader', { name: 'Total' })).toBeVisible();

    // Daily Total row in footer
    await expect(page.getByText('Daily Total')).toBeVisible();
  });

  test('week navigation: previous and next week buttons work', async ({ page }) => {
    // Capture the current week label
    const weekLabel = page.getByText(/week of/i);
    const initialText = await weekLabel.textContent();

    // Click previous week button (ChevronLeft)
    await page.locator('button:has(svg)').first().click();

    // Week label should change
    await expect(weekLabel).not.toHaveText(initialText!, { timeout: 5000 });
    const prevWeekText = await weekLabel.textContent();

    // Click next week button (ChevronRight) — should go back
    // The next button is the second icon button
    await page.locator('button:has(svg[data-testid="ChevronRightIcon"])').click();

    // Should return to original week
    await expect(weekLabel).toHaveText(initialText!, { timeout: 5000 });
  });

  test('This Week button returns to current week', async ({ page }) => {
    // Capture current week label
    const weekLabel = page.getByText(/week of/i);
    const initialText = await weekLabel.textContent();

    // Navigate to previous week
    await page.locator('button:has(svg[data-testid="ChevronLeftIcon"])').click();
    await expect(weekLabel).not.toHaveText(initialText!, { timeout: 5000 });

    // Click "This Week"
    await page.getByRole('button', { name: /this week/i }).click();

    // Should be back to the original week
    await expect(weekLabel).toHaveText(initialText!, { timeout: 5000 });
  });

  test('can remove a project row from the grid', async ({ page }) => {
    // Clear and add a project
    await page.evaluate(() => {
      localStorage.removeItem('weeklyGrid:projectRows');
      localStorage.removeItem('weeklyGrid:taskTypes');
    });
    await page.reload();
    await expect(page).toHaveURL(/\/weekly-grid/);

    await page.getByLabel('Add project').click();
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();
    await page.getByRole('button', { name: /^add$/i }).click();

    // Verify the project row is visible
    await expect(page.getByText('Brand Refresh Campaign')).toBeVisible({
      timeout: 10000,
    });

    // Click the remove (delete) button for the project row
    await page.getByRole('button', { name: /remove project/i }).click();

    // Project should disappear and empty state should return
    await expect(page.getByText(/add a project above to start logging time/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('batch log description text is shown', async ({ page }) => {
    await expect(page.getByText(/batch-log your time for the week/i)).toBeVisible();
  });
});
