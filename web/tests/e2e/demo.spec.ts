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
    test.setTimeout(600_000); // 10 minutes for the full demo walkthrough

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
    await page.getByLabel('Full name').pressSequentially(testName, { delay: 80 });
    await page.waitForTimeout(400);

    await page.getByLabel('Email address').click();
    await page.getByLabel('Email address').pressSequentially(testEmail, { delay: 60 });
    await page.waitForTimeout(400);

    await page.getByLabel('Password').click();
    await page.getByLabel('Password').pressSequentially(testPassword, { delay: 60 });
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

    await expect(page.getByText('Active Projects', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Hours This Week', { exact: true })).toBeVisible();
    await expect(page.getByText('Open Tasks', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(1000);
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

    await expect(page.getByText(/Brand Refresh Campaign/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 4. Project Detail — Overview & Board View
    // ------------------------------------------------------------------
    await subtitle(page, 'Project overview shows stats, budget, and milestone summary');
    await page.waitForTimeout(600);

    await page.getByText('Brand Refresh Campaign').first().click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await page.waitForTimeout(1000);

    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Switch to Tasks tab
    await subtitle(page, 'Tasks tab shows board, milestones, and people views');
    await page.waitForTimeout(600);
    await page.getByRole('tab', { name: /tasks/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('TODO').first()).toBeVisible({ timeout: 10000 });
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

    await page.getByRole('button', { name: /milestones/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 6. Project Detail — People View
    // ------------------------------------------------------------------
    await subtitle(page, 'People view shows task assignments per team member with weekly hours');
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /people/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 7. Project Detail — Dashboard Tab
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Dashboard tab shows project analytics \u2014 hours, costs by task type, member, and month',
    );
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /dashboard/i }).click();
    await page.waitForTimeout(1000);

    // Wait for stats to load
    await expect(page.getByText('Overview').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Scroll to see more stats
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);

    // ------------------------------------------------------------------
    // 8. Time Logging — Weekly Grid
    // ------------------------------------------------------------------
    await subtitle(page, 'Time Logging opens with the Weekly Grid for batch time entry');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Time Logging', { exact: true }).click();
    await expect(page).toHaveURL(/\/time-logging/);
    await page.waitForTimeout(1000);

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
    // 9. Time Logging — Holidays Button
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Team members can manage their holidays directly from the time entry page',
    );
    await page.waitForTimeout(600);

    const holidaysButton = page.getByRole('button', { name: /holidays/i });
    if (await holidaysButton.isVisible()) {
      await holidaysButton.click();
      await page.waitForTimeout(1000);

      // Show the holidays modal
      await expect(page.getByText(/my holidays/i).first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1500);

      // Close the modal
      const closeButton = page.getByRole('button', { name: /close/i });
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // ------------------------------------------------------------------
    // 10. Time Logging — Quick Entry
    // ------------------------------------------------------------------
    await subtitle(page, 'Quick Entry lets you log time against project tasks');
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /quick entry/i }).click();
    await page.waitForTimeout(800);

    await page.getByRole('combobox', { name: /select project/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('option', { name: /brand refresh campaign/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('option', { name: /brand refresh campaign/i }).click();
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 11. Log Time
    // ------------------------------------------------------------------
    await subtitle(page, 'Logging 2 hours of development work on a task');
    await page.waitForTimeout(600);

    await expect(page.getByLabel('Hours')).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Hours').click();
    await page.getByLabel('Hours').fill('2');
    await page.waitForTimeout(400);

    await page.getByRole('combobox', { name: /task type/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: /development & testing/i }).click();
    await page.waitForTimeout(400);

    await page.getByLabel('Notes (optional)').click();
    await page
      .getByLabel('Notes (optional)')
      .pressSequentially('Working on competitor analysis report', { delay: 50 });
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: /log entry/i }).click();
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 12. Standup — Holidays & Projects
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Standup starts with team availability \u2014 who is off today, this week, and next week',
    );
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Standup', { exact: true }).click();
    await expect(page).toHaveURL(/\/standup/);
    await page.waitForTimeout(800);

    // The carousel starts with the holidays/availability slide
    await expect(page.getByText(/availability/i).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Advance past holidays slide to the first project
    await subtitle(page, 'Each project shows its own task board during standup');
    await page.waitForTimeout(600);

    const nextButton = page.locator('button:has([data-testid="ArrowForwardIosIcon"])');
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(/1\//).first()).toBeVisible({ timeout: 5000 });
      await page.waitForTimeout(1500);

      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(1000);
        await expect(page.getByText(/2\//).first()).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);
      }
    }
    await page.waitForTimeout(800);

    // ------------------------------------------------------------------
    // 13. Team Calendar
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Team Calendar shows holidays, office events, and team availability at a glance',
    );
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Team Calendar', { exact: true }).click();
    await expect(page).toHaveURL(/\/team-calendar/);
    await page.waitForTimeout(1500);

    // Let the calendar render
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 14. Admin — Clients
    // ------------------------------------------------------------------
    await subtitle(page, 'Admin section manages clients, team, rates, holidays, and events');
    await page.waitForTimeout(600);

    await page.locator('.MuiDrawer-root').getByText('Admin', { exact: true }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await page.waitForTimeout(800);

    await expect(page.getByRole('tab', { name: /clients/i })).toBeVisible();
    await expect(page.getByText(/Acme Corp/i).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 15. Create a Client
    // ------------------------------------------------------------------
    await subtitle(page, 'Adding a new client to the system');
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /new client/i }).click();
    await expect(page.getByRole('heading', { name: /new client/i })).toBeVisible();
    await page.waitForTimeout(600);

    await page.getByLabel('Client Name').click();
    await page
      .getByLabel('Client Name')
      .pressSequentially(`Nova Digital ${timestamp}`, { delay: 70 });
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
    // 16. Admin — Team
    // ------------------------------------------------------------------
    await subtitle(page, 'The team directory shows all members and their roles');
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /team/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(/Active/i).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 17. Admin — Task Rates
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Task Rates define day rates per task type \u2014 used to calculate project costs',
    );
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /task rates/i }).click();
    await page.waitForTimeout(1000);

    // Wait for content to load
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 18. Admin — Public Holidays
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Public holidays are blocked on time entry and shown in the team calendar',
    );
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /public holidays/i }).click();
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 19. Admin — Office Events
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Office events can optionally block time tracking \u2014 like company days or retreats',
    );
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /office events/i }).click();
    await page.waitForTimeout(1000);
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 20. Admin — Time Entries
    // ------------------------------------------------------------------
    await subtitle(
      page,
      'Time Entries tab lets admins review all logged time \u2014 filterable by client, project, member, and date',
    );
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /time entries/i }).click();
    await page.waitForTimeout(1000);

    // Wait for entries to load
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 21. Admin — Audit Log
    // ------------------------------------------------------------------
    await subtitle(page, 'The Audit Log tracks every change made in the system');
    await page.waitForTimeout(600);

    await page.getByRole('tab', { name: /audit log/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    const firstExpandButton = page.locator('table tbody tr').first().locator('button').first();
    if ((await firstExpandButton.count()) > 0) {
      await firstExpandButton.click();
      await page.waitForTimeout(1500);
    }

    // ------------------------------------------------------------------
    // 22. Filter Audit Log
    // ------------------------------------------------------------------
    await subtitle(page, 'Audit entries can be filtered by entity type, action, and date range');
    await page.waitForTimeout(600);

    const entityTypeSelect = page.locator(
      '.MuiFormControl-root:has(label:text("Entity Type")) .MuiSelect-select',
    );
    await entityTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'Project' }).click();
    await page.waitForTimeout(1500);

    await entityTypeSelect.click();
    await page.waitForTimeout(300);
    await page.getByRole('option', { name: 'All' }).click();
    await page.waitForTimeout(1000);

    // ------------------------------------------------------------------
    // 23. Logout
    // ------------------------------------------------------------------
    await subtitle(page, 'Signing out returns to the login page');
    await page.waitForTimeout(600);

    await page.locator('[data-testid="user-menu-button"]').click();
    await page.waitForTimeout(500);
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await page.waitForTimeout(1500);

    // ------------------------------------------------------------------
    // 24. Login
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
    // 25. Final Dashboard
    // ------------------------------------------------------------------
    await subtitle(page, 'EHE Studio Ops v1.0 \u2014 Studio operations, simplified.');
    await page.waitForTimeout(2000);

    await clearSubtitle(page);
    await page.waitForTimeout(1500);
  });
});
