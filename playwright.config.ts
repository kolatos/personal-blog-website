import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright konfigurasi E2E untuk Personal Blog Website.
 *
 * - baseURL  : Vite dev server (dijalankan manual sebelum test)
 * - testDir  : e2e/
 * - Browser  : Chromium (headless)
 *
 * Jalankan dev server secara manual terlebih dahulu:
 *   cd frontend && npm run dev
 * Kemudian dari root:
 *   npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',

  /* Jalankan test secara paralel */
  fullyParallel: true,

  /* Gagalkan build CI jika ada test.only yang tersisa */
  forbidOnly: !!process.env.CI,

  /* Tidak ada retry secara default; aktifkan di CI */
  retries: process.env.CI ? 2 : 0,

  /* Reporter */
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    /* Frontend Vite dev server */
    baseURL: 'http://localhost:5173',

    /* Kumpulkan trace saat retry pertama untuk debug */
    trace: 'on-first-retry',

    /* Screenshot saat gagal */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /*
   * webServer: gunakan reuseExistingServer agar test bisa jalan
   * meski dev server sudah berjalan di terminal terpisah.
   * Playwright tidak akan start server baru jika port sudah tersedia.
   */
  webServer: {
    command: 'npm run dev',
    cwd: './frontend',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
