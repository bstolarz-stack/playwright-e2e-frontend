import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['line'], // Console output
    ['allure-playwright'], // Allure report
  ],

  use: {
    headless: true,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'on',
    locale: 'es-AR',
    geolocation: { latitude: -34.9205, longitude: -57.9536 }, // La Plata, Provincia de Buenos Aires
    permissions: ['geolocation'],
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--ignore-gpu-blocklist',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
      ],
    },
  },

  outputDir: 'test-results',

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }, // Explicit: don't let top-level override surprise us
      },
    },
  ],
});
