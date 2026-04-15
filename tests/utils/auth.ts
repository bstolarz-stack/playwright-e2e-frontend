import { expect, Page } from '@playwright/test';

export async function login(page: Page, username: string, password: string) {
  const ingresarButton = page.getByText('Ingresar', { exact: false });
  if (await ingresarButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await ingresarButton.first().click();
  } else {
    await page.evaluate(() => {
      const els = document.querySelectorAll('a, button');
      for (const el of els) {
        if (el.textContent?.trim() === 'Ingresar' || el.textContent?.trim() === 'INGRESAR') {
          (el as HTMLElement).click();
          return;
        }
      }
    });
  }
  await page.waitForTimeout(3000);

  await page.locator('#LoginUserName').fill(username);
  await page.locator('#LoginPassword').fill(password);
  await page.screenshot({ path: 'test-results/02-credentials.png' });

  await Promise.all([
    page.waitForResponse((r) => r.url().includes('login'), { timeout: 15_000 }).catch(() => null),
    page.locator('form[action*="login"] button[type="submit"]').click(),
  ]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/03-after-submit.png' });
}

export async function manejarModalGeolocalizacion(page: Page) {
  const geoModal = page.locator('#modalValidateGeopositionLogin.show');
  const hasGeoModal = await geoModal.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasGeoModal) {
    const continuarBtn = geoModal.locator('button, a').filter({ hasText: 'CONTINUAR' });
    if (await continuarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await continuarBtn.click();
      console.log('Clicked CONTINUAR on geo modal (native click)');
    } else {
      const omitirBtn = geoModal.locator('button, a').filter({ hasText: 'OMITIR' });
      await omitirBtn.click();
      console.log('Clicked OMITIR on geo modal (native click)');
    }
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'test-results/04-after-geo-continuar.png' });
  }

  await page.waitForTimeout(3000);
}

export async function verificarLogin(page: Page) {
  let loggedIn = await page.evaluate(() => {
    const header = document.querySelector('header')?.innerText || '';
    return !header.includes('INGRESAR');
  });

  await page.screenshot({ path: 'test-results/05-login-check.png' });

  if (!loggedIn) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal.show').forEach((m) => {
        m.classList.remove('show');
        (m as HTMLElement).style.display = 'none';
      });
      document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
      document.body.classList.remove('modal-open');
    });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    loggedIn = await page.evaluate(() => {
      const header = document.querySelector('header')?.innerText || '';
      return !header.includes('INGRESAR');
    });
    await page.screenshot({ path: 'test-results/06-after-reload.png' });
  }

  expect(loggedIn, 'El login deberia ser exitoso').toBeTruthy();
}
