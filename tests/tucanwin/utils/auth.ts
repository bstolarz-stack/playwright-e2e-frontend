import { Page, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load tucanwin-specific credentials
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env.tucanwin') });

// Source of truth: BASE_URL en .env.tucanwin (cargado arriba via dotenv).
// Fallback al env de testing si no esta seteado. Sin trailing slash para componer rutas.
export const TUCANWIN_BASE_URL = (
  process.env.BASE_URL || 'https://gfront-tucanwin-testing.gampix.dev'
).replace(/\/$/, '');

export const TUCANWIN_CREDS = {
  username: process.env.APP_USERNAME || '',
  password: process.env.PASSWORD || '',
};

/**
 * Navigate to TucanWin testing site and perform login.
 * IMPORTANT: On the testing env (gfront-tucanwin-testing.gampix.dev) the login
 * modal AUTO-FILLS the credentials. Do NOT touch the inputs — just click submit.
 * Site has zero data-testid, relies on text/role selectors.
 */
export async function loginTucanwin(page: Page): Promise<void> {
  await page.goto(TUCANWIN_BASE_URL, { waitUntil: 'domcontentloaded' });

  // Close countdown banner if present (optional)
  const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
  if (await countdownClose.isVisible().catch(() => false)) {
    await countdownClose.click().catch(() => {});
  }

  // Click "Ingresá" to open login modal (note: accent on the 'á')
  await page.getByRole('button', { name: /^Ingres[aá]$/i }).click();

  // Wait briefly for the modal to mount and auto-fill credentials
  await page.waitForTimeout(500);

  // Submit (credentials are pre-filled by the testing env)
  await page.getByRole('button', { name: /^Ingresar$/i }).click();

  // Verify we're logged in: balance button (with $) appears in header
  await expect(page.locator('header').getByRole('button', { name: /\$/ })).toBeVisible({
    timeout: 20_000,
  });
}
