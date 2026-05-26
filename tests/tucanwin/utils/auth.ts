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
 * Navigate to TucanWin and perform login using credentials from `.env.tucanwin`
 * (APP_USERNAME = DNI, PASSWORD = contrasena).
 *
 * Modal de login (sin testids):
 *   - textbox "DNI"
 *   - textbox "Contraseña"
 *   - button "Iniciar sesión"
 *
 * Verifica el login esperando que aparezca el boton del balance ($) en el header.
 */
export async function loginTucanwin(page: Page): Promise<void> {
  await page.goto(TUCANWIN_BASE_URL, { waitUntil: 'domcontentloaded' });

  // Close countdown banner if present (intercepts pointer events)
  const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
  if (await countdownClose.isVisible().catch(() => false)) {
    await countdownClose.click().catch(() => {});
  }

  // Open login modal
  await page.getByRole('button', { name: /^Ingres[aá]$/i }).click();

  // Fill credentials. El env de testing solia auto-rellenar; la modal nueva
  // no lo hace mas, asi que llenamos siempre desde TUCANWIN_CREDS.
  await page.getByRole('textbox', { name: /^DNI$/i }).fill(TUCANWIN_CREDS.username);
  await page.getByRole('textbox', { name: /Contrase[nñ]a/i }).fill(TUCANWIN_CREDS.password);

  // Submit
  await page.getByRole('button', { name: /^Iniciar sesi[oó]n$/i }).click();

  // Verify we're logged in: balance button (with $) appears in header
  await expect(page.locator('header').getByRole('button', { name: /\$/ })).toBeVisible({
    timeout: 20_000,
  });
}
