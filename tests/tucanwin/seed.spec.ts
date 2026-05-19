import { test } from '@playwright/test';
import { TUCANWIN_BASE_URL } from './utils/auth';

test.describe('TucanWin seed', () => {
  test('Abrir home de tucanwin', async ({ page }) => {
    await page.goto(TUCANWIN_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
    if (await countdownClose.isVisible().catch(() => false)) {
      await countdownClose.click().catch(() => {});
    }
  });
});
