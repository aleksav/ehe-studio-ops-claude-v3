import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
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
      command: 'cd ../api && PORT=3001 DATABASE_URL="postgresql://aleksav@localhost:5432/ehestudio_ops_dev" JWT_SECRET="test-secret" npx tsx src/index.ts',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 3000',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
