import { test, expect } from '@playwright/test';
import { TUCANWIN_BASE_URL } from '../utils/auth';

/**
 * Smoke UI - Home de TucanWin.
 * Cobertura: GPX-5802.
 *
 * Plan: tests/tucanwin/smoke.plan.md (suite "home").
 * No requiere usuario logueado.
 */

test.beforeEach(async ({ page }) => {
  await page.goto(TUCANWIN_BASE_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
  if (await countdownClose.isVisible().catch(() => false)) {
    await countdownClose.click().catch(() => {});
  }
});

test('home (sin login) - carga con header, banners y footer', async ({ page }) => {
  await test.step('Header con logo y CTAs de auth', async () => {
    await expect(page).toHaveTitle(/tucanwin/i);
    const header = page.locator('header').first();
    await expect(header.getByRole('button', { name: /^Ingres[aá]$/i })).toBeVisible();
    await expect(header.getByRole('link', { name: /^Registrate$/i })).toBeVisible();
  });

  await test.step('Carousel de banners visible con controles', async () => {
    await expect(page.getByRole('button', { name: /banner anterior/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /siguiente banner/i })).toBeVisible();
    const dots = page.getByRole('button', { name: /^ir al banner \d+$/i });
    expect(await dots.count()).toBeGreaterThanOrEqual(2);
  });

  await test.step('Footer con secciones JUEGOS / TUCANWIN / AYUDA y logos de pago', async () => {
    const footer = page.locator('footer, [class*="footer" i]').last();
    await footer.scrollIntoViewIfNeeded().catch(() => {});
    await expect(page.getByText('JUEGOS', { exact: true })).toBeVisible();
    await expect(page.getByText('TUCANWIN', { exact: true })).toBeVisible();
    await expect(page.getByText('AYUDA', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /MercadoPago/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /RapiPago/i })).toBeVisible();
    await expect(page.getByRole('img', { name: /\+18/ })).toBeVisible();
  });
});

test('home (sin login) - toggle del menu lateral abre y cierra', async ({ page }) => {
  const toggleBtn = page.getByRole('button', { name: /toggle menu/i });
  const closeBtn = page.getByRole('button', { name: /cerrar menu/i });
  const menuLink = (name: RegExp) => page.getByRole('link', { name });

  await test.step('Abrir el menu lateral y verificar links principales', async () => {
    await toggleBtn.click();
    await expect(menuLink(/^ir a slots$/i)).toBeVisible();
    await expect(menuLink(/^ir a casino$/i)).toBeVisible();
    await expect(menuLink(/^ir a home$/i)).toBeVisible();
    await expect(menuLink(/^ir a casino vivo$/i)).toBeVisible();
    await expect(menuLink(/^ir a deportes$/i)).toBeVisible();
    await expect(menuLink(/^ir a promos$/i)).toBeVisible();
  });

  await test.step('Cerrar el menu lateral', async () => {
    await closeBtn.click();
    // El menu lateral se traslada fuera del viewport via CSS transform — los
    // links siguen en el DOM, asi que verificamos que no esten visibles en
    // viewport en vez de toBeHidden().
    await expect(menuLink(/^ir a slots$/i)).not.toBeInViewport();
  });
});

test('home (sin login) - bottom nav navega entre secciones', async ({ page }) => {
  const bottomNav = page.locator('nav').filter({ has: page.getByRole('link', { name: /^Casino$/i }) }).last();

  await test.step('Bottom nav abre Casino', async () => {
    await bottomNav.getByRole('link', { name: /^Casino$/i }).click();
    await page.waitForURL(/\/casino(?!\/|-vivo)/i, { timeout: 15_000 });
    expect(page.url()).toContain('/casino');
  });

  await test.step('Bottom nav vuelve a Home', async () => {
    await page.locator('nav').last().getByRole('link', { name: /^Home$/i }).click();
    await page.waitForURL(`${TUCANWIN_BASE_URL}/`, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/');
  });

  await test.step('Bottom nav abre Deportes', async () => {
    await page.locator('nav').last().getByRole('link', { name: /Deportes/i }).click();
    await page.waitForURL(/\/sports/i, { timeout: 15_000 });
    expect(page.url()).toContain('/sports');
  });
});

test('home (sin login) - sliders muestran tarjetas de juegos', async ({ page }) => {
  // Estructura del slider: header (heading + "Ver todos") y grid de cards son
  // siblings dentro de un container. Por eso scopeamos al ancestor mas cercano
  // que contenga BOTH el link "Ver todos" Y al menos una imagen de juego con alt
  // — funciona tanto en UAT (con testids) como en PROD (sin ellos).
  const sectionByHeading = (heading: RegExp) =>
    page
      .getByRole('heading', { name: heading })
      .locator(
        'xpath=ancestor::*[.//a[normalize-space()="Ver todos"] and .//img[@alt and string-length(@alt)>0]][1]',
      );

  // En UAT/PROD los cards usan <img alt="<nombre del juego>">.
  const cardCount = (slider: ReturnType<typeof sectionByHeading>) =>
    slider.locator('img[alt]:not([alt=""])').count();

  await test.step('Slider "LOS MAS JUGADOS" visible con tarjetas y "Ver todos"', async () => {
    const slider = sectionByHeading(/LOS\s+M[ÁA]S\s+JUGADOS/i);
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeVisible();
    await expect(slider.getByRole('link', { name: /^Ver todos$/i })).toBeVisible();
    expect(await cardCount(slider)).toBeGreaterThanOrEqual(5);
  });

  await test.step('Slider "JUEGOS DESTACADOS" visible con al menos una tarjeta', async () => {
    const slider = sectionByHeading(/JUEGOS\s+DESTACADOS/i);
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toBeVisible();
    expect(await cardCount(slider)).toBeGreaterThanOrEqual(1);
  });
});
