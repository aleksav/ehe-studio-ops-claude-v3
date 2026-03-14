import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Demo recording configuration
// ---------------------------------------------------------------------------

test.use({
  video: 'on',
  viewport: { width: 1280, height: 720 },
});

// ---------------------------------------------------------------------------
// Subtitle helpers
// ---------------------------------------------------------------------------

async function subtitle(page: import('@playwright/test').Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-subtitle-bar');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-subtitle-bar';
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        zIndex: '999999',
        background: 'rgba(0, 0, 0, 0.75)',
        color: '#ffffff',
        fontFamily: '"DM Sans", "Inter", system-ui, sans-serif',
        fontSize: '18px',
        fontWeight: '500',
        textAlign: 'center',
        padding: '14px 32px',
        letterSpacing: '0.3px',
        lineHeight: '1.5',
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = '1';
  }, text);
}

async function clearSubtitle(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const el = document.getElementById('demo-subtitle-bar');
    if (el) {
      el.style.opacity = '0';
    }
  });
}

// ---------------------------------------------------------------------------
// Demo test — full app walkthrough
// ---------------------------------------------------------------------------

test.describe('Demo Recording', () => {
  test('full app walkthrough with subtitles', async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes for the full demo walkthrough

    const timestamp = Date.now();
    const testName = 'Demo User';
    const testEmail = `demo-${timestamp}@ehe.ai`;
    const testPassword = 'Password123';

    // ------------------------------------------------------------------
    // 1. Registration
    // ------------------------------------------------------------------
    await page.goto('/register');
    await page.waitForTimeout(800);
    await subtitle(page, 'Creating a new account on EHE Studio Ops');
    await page.waitForTimeout(1500);

    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await page.waitForTimeout(500);

    await page.getByLabel('Full name').click();
    await page.getByLabel('Full name').pressSequentially(testName, {
      delay: 80,
    });
    await page.waitForTimeout(400);

    await page.getByLabel('Email address').click();
    await page.getByLabel('Email address').pressSequentially(testEmail, {
      delay: 60,
    });
    await page.waitForTimeout(400);

    await page.getByLabel('Password').click();
    await page.getByLabel('Password').pressSequentially(testPassword, {
      delay: 60,
    });
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 2. Dashboard
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'The dashboard shows an overview of your work \u2014 tasks, hours, and active projects',
    );
    await page.waitForTimeout(800);

    // Wait for summary cards to load
    await expect(page.getByText('Active Projects', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Hours This Week', { exact: true })).toBeVisible();
    await expect(page.getByText('Open Tasks', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);

    // Scroll down to show more of the dashboard
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);

    // Scroll to daily hours chart
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);

    // ------------------------------------------------------------------
    // 3. Projects
    // ------------------------------------------------------------------
    await subtitle(page, 'Viewing all projects with their status and client');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Projects', { exact: true }).click();
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await page.waitForTimeout(1500);

    // Wait for project cards to render
    await expect(page.getByText(/Brand Refresh Campaign/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 4. Project Detail — Board View
    // ------------------------------------------------------------------
    await subtitle(page, 'The Board view shows tasks organized by status columns');
    await page.waitForTimeout(600);

    // Click into "Brand Refresh Campaign"
    await page.getByText('Brand Refresh Campaign').first().click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await page.waitForTimeout(1000);

    // Overview tab shows stats, budget, milestones summary
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Switch to Tasks tab
    await subtitle(page, 'Tasks tab shows board, milestones, and people views');
    await page.waitForTimeout(600);
    await page.getByRole('tab', { name: /tasks/i }).click();
    await page.waitForTimeout(1000);

    // Wait for the board to load
    await expect(page.getByText('TODO').first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('In Progress').first()).toBeVisible();
    await expect(page.getByText('Done').first()).toBeVisible();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 5. Project Detail — Milestones View
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Milestone view groups tasks under their milestone with progress tracking',
    );
    await page.waitForTimeout(600);

    // Click the Milestones toggle button
    await page.getByRole('button', { name: /milestones/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 6. Project Detail — People View
    // ------------------------------------------------------------------
    await subtitle(page, 'People view shows task assignments per team member with weekly hours');
    await page.waitForTimeout(600);

    // Click the People toggle button
    await page.getByRole('button', { name: /people/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 7. Admin — Clients
    // ------------------------------------------------------------------
    await subtitle(page, 'Admin section manages clients, team, and audit log');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Admin', { exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await page.waitForTimeout(800);

    // Clients tab is the default
    await expect(page.getByRole('tab', { name: /clients/i })).toBeVisible();
    await page.waitForTimeout(500);

    // Wait for clients to load
    await expect(page.getByText(/Acme Corp/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 8. Create a Client
    // ------------------------------------------------------------------
    await subtitle(page, 'Adding a new client to the system');
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /new client/i }).click();
    await expect(page.getByRole('heading', { name: /new client/i })).toBeVisible();
    await page.waitForTimeout(600);

    await page.getByLabel('Client Name').click();
    await page.getByLabel('Client Name').pressSequentially(`Nova Digital ${timestamp}`, {
      delay: 70,
    });
    await page.waitForTimeout(400);

    await page.getByLabel('Contact Name').click();
    await page.getByLabel('Contact Name').pressSequentially('Sarah Mitchell', { delay: 70 });
    await page.waitForTimeout(400);

    await page.getByLabel('Contact Email').click();
    await page.getByLabel('Contact Email').pressSequentially('sarah@novadigital.io', { delay: 50 });
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: /create client/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    // ------------------------------------------------------------------
    // 9. Admin — Team
    // ------------------------------------------------------------------
    await subtitle(page, 'The team directory shows all members and their roles');
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /team/i }).click();
    await page.waitForTimeout(1000);

    // Wait for team members to load
    await expect(page.getByText(/Active/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 10. Time Logging — Weekly Grid (default tab)
    // ------------------------------------------------------------------
    await subtitle(page, 'Time Logging opens with the Weekly Grid for batch time entry');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Time Logging', { exact: true }).click();
    await expect(page).toHaveURL(/\/time-logging/);
    await page.waitForTimeout(1000);

    // Weekly Grid is the default first tab
    await expect(page.getByRole('tab', { name: /weekly grid/i })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add a project row
    const addProjectCombo = page.getByRole('combobox', { name: /add project/i });
    if (await addProjectCombo.isVisible()) {
      await addProjectCombo.click();
      await page.waitForTimeout(500);
      const projectOptions = page.getByRole('option');
      const optionCount = await projectOptions.count();
      if (optionCount > 0) {
        await projectOptions.first().click();
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: /^add$/i }).click();
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 11. Time Logging — Quick Entry
    // ------------------------------------------------------------------
    await subtitle(page, 'Quick Entry lets you log time against project tasks');
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /quick entry/i }).click();
    await page.waitForTimeout(800);

    // Select a project
    await page.getByRole('combobox', { name: /select project/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 12. Log Time
    // ------------------------------------------------------------------
    await subtitle(page, 'Logging 2 hours of development work on a task');
    await page.waitForTimeout(600);

    // The form should now be visible
    await expect(page.getByLabel('Hours')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('2');
    await page.waitForTimeout(400);

    // Select task type
    await page.getByRole('combobox', { name: /task type/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /development & testing/i }).click();
    await page.waitForTimeout(400);

    // Add notes
    await page.getByLabel('Notes (optional)').click();
    await page
      .getByLabel('Notes (optional)')
      .pressSequentially('Working on competitor analysis report', {
        delay: 50,
      });
    await page.waitForTimeout(400);

    // Submit
    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 13. Standup
    // ------------------------------------------------------------------
    await subtitle(page, 'The Standup carousel guides the team through each project one at a time');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Standup', { exact: true }).click();
    await expect(page).toHaveURL(/\/standup/);
    await page.waitForTimeout(800);

    // The carousel auto-loads the first active project — wait for the counter
    await expect(page.getByText(/1\//).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Show the kanban board for the first project
    await expect(page.getByText('TODO').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Click the Next arrow to advance to the next project
    const nextButton = page.locator('button:has([data-testid="ArrowForwardIosIcon"])');
    if (await nextButton.isEnabled()) {
      await subtitle(page, 'Clicking through projects — each one shows its own task board');
      await page.waitForTimeout(600);
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Wait for the next project's board to render
      await expect(page.getByText(/2\//).first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1500);

      // Advance once more if possible
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        await expect(page.getByText(/3\//).first()).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);
      }
    }

    // Check for the "Up next" teaser beside the next arrow
    const upNext = page.getByText('Up next');
    if (await upNext.isVisible()) {
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(800);

    // ------------------------------------------------------------------
    // 14. Admin — Audit Log
    // ------------------------------------------------------------------
    await subtitle(page, 'The Audit Log tracks every change made in the system');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Admin', { exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.waitForTimeout(500);
    await page.getByRole('tab', { name: /audit log/i }).click();
    await page.waitForTimeout(1000);

    // Wait for entries to load
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    // Expand the first row that has changed fields
    const firstExpandButton = page.locator('table tbody tr').first().locator('button').first();
    if ((await firstExpandButton.count()) > 0) {
      await firstExpandButton.click();
      await page.waitForTimeout(1500);
    }

    // ------------------------------------------------------------------
    // 15. Filter Audit Log
    // ------------------------------------------------------------------
    await subtitle(page, 'Audit entries can be filtered by entity type, action, and date range');
    await page.waitForTimeout(600);

    // Apply entity type filter — MUI Select without labelId needs a DOM-based selector
    const entityTypeSelect = page.locator(
      '.MuiFormControl-root:has(label:text("Entity Type")) .MuiSelect-select',
    );
    await entityTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'Project' }).click();
    await page.waitForTimeout(1500);

    // Clear the filter to show all again
    await entityTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'All' }).click();
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 16. Logout
    // ------------------------------------------------------------------
    await subtitle(page, 'Signing out returns to the login page');
    await page.waitForTimeout(600);

    await page.locator('[data-testid="user-menu-button"]').click();
    await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 17. Login
    // ------------------------------------------------------------------
    await subtitle(page, 'Logging back in with existing credentials');
    await page.waitForTimeout(600);

    await page.getByLabel('Email address').click();
    await page.getByLabel('Email address').pressSequentially(testEmail, { delay: 50 });
    await page.waitForTimeout(400);

    await page.getByLabel('Password').click();
    await page.getByLabel('Password').pressSequentially(testPassword, { delay: 50 });
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 18. Final Dashboard
    // ------------------------------------------------------------------
    await subtitle(page, 'EHE Studio Ops \u2014 Studio operations, simplified.');
    await page.waitForTimeout(2000);

    await clearSubtitle(page);
    await page.waitForTimeout(1500);
  });
});
