import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for SayWhatWant
 * Optimized for Chrome desktop testing with Cloudflare deployment
 */
export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Maximum time one test can run
  timeout: 60 * 1000,
  
  // Run tests in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for tests (will use local dev server or deployed URL)
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    
    // Collect trace on failure for debugging
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording on failure
    video: 'retain-on-failure',
    
    // Browser context options
    viewport: { width: 1920, height: 1080 },
    
    // Emulate timezone
    timezoneId: 'America/Los_Angeles',
    
    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  // Configure projects for Chrome desktop only (as requested)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before starting tests (for local testing)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

