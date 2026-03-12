import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

const dbUrl =
  process.env.DATABASE_URL ||
  'postgresql://aleksav@localhost:5432/ehestudio_ops_dev';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `cd ../api && PORT=3001 DATABASE_URL="${dbUrl}" JWT_SECRET="test-secret" ALLOWED_EMAIL_DOMAINS="ehe.ai,tsf.tech,thestartupfactory.tech" npx tsx src/index.ts`,
      port: 3001,
      reuseExistingServer: !isCI,
      timeout: 30000,
    },
    {
      command: 'npx vite --port 3000',
      port: 3000,
      reuseExistingServer: !isCI,
      timeout: 30000,
    },
  ],
});
