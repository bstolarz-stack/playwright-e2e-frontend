import { Page } from '@playwright/test';

export async function navegarYSeleccionarCiudad(page: Page) {
  await page.goto('https://sportsbet.com.ar', { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(3000);

  const bsAsButton = page.getByText('Bs.As', { exact: false });
  if (await bsAsButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await bsAsButton.first().click();
  } else {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, a, [role="button"], .btn');
      for (const btn of btns) {
        if (btn.textContent?.includes('Bs.As')) {
          (btn as HTMLElement).click();
          return;
        }
      }
    });
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/01-city-selected.png' });

  if (!page.url().includes('pba.sports.bet.ar')) {
    await page.goto('https://pba.sports.bet.ar/casino/index', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(3000);
  }
}
