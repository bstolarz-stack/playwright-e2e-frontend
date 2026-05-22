import { test, expect } from '@playwright/test';
import { TUCANWIN_BASE_URL } from '../utils/auth';

/**
 * Smoke UI - Deportes (widget Digitain) de TucanWin.
 * Cobertura: GPX-5803.
 *
 * Plan: tests/tucanwin/smoke.plan.md (suite "deportes-digitain").
 * No requiere usuario logueado.
 *
 * El widget vive en un iframe cross-origin servido por
 * sport.tucanwin-frontend.wildar.dev (proveedor Digitain). Toda la
 * interaccion del scope va contra ese iframe via frameLocator.
 *
 * IMPORTANTE: El env de testing (gfront-tucanwin-testing.gampix.dev) responde
 * 404 en /sports al momento de escribir esta suite. Estos tests estan
 * pensados para correr contra el env de PROD: ejecutar con
 *   BASE_URL=https://tucanwin.bet.ar npx playwright test deportes.spec.ts
 */

const DIGITAIN_IFRAME_SELECTOR = 'iframe[src*="SportsBook"]';

test.beforeEach(async ({ page }) => {
  await page.goto(`${TUCANWIN_BASE_URL}/sports`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
  if (await countdownClose.isVisible().catch(() => false)) {
    await countdownClose.click().catch(() => {});
  }

  // El widget Digitain hidrata async. El iframe puede tardar en aparecer
  // porque el script del widget lo inyecta despues del bootstrap del SPA.
  // Polleamos page.frames() hasta encontrar uno cuya URL apunte a Digitain
  // (sport.tucanwin-frontend.wildar.dev/SportsBook).
  await expect
    .poll(
      () =>
        page
          .frames()
          .some((f) => f.url().includes('SportsBook')),
      { timeout: 90_000, intervals: [1000, 2000, 3000] },
    )
    .toBe(true);

  const digitain = page.frameLocator(DIGITAIN_IFRAME_SELECTOR);
  await expect(
    digitain.getByRole('textbox', { name: /Encuentre su partido/i }),
  ).toBeVisible({ timeout: 60_000 });
});

test('deportes (sin login) - pagina /sports carga el iframe Digitain con search y tabs', { tag: '@prod' }, async ({
  page,
}) => {
  await test.step('La pagina /sports responde con el titulo esperado', async () => {
    expect(page.url()).toContain('/sports');
    await expect(page).toHaveTitle(/Apuestas Deportivas Online/i);
  });

  const digitain = page.frameLocator(DIGITAIN_IFRAME_SELECTOR);

  await test.step('El iframe Digitain expone el search', async () => {
    await expect(
      digitain.getByRole('textbox', { name: /Encuentre su partido/i }),
    ).toBeVisible();
  });

  await test.step('Tabs Inicio / Vision de conjunto / Vista multiple / Calendario / Resultados visibles', async () => {
    // Los textos de los tabs estan dentro del iframe Digitain. Usamos
    // .first() porque algunos labels pueden repetirse en sub-paneles.
    await expect(digitain.getByText(/^\s*Inicio\s*$/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(digitain.getByText(/Visi[oó]n de conjunto/i).first()).toBeVisible();
    await expect(digitain.getByText(/Vista m[uú]ltiple/i).first()).toBeVisible();
    await expect(digitain.getByText(/^\s*Calendario\s*$/i).first()).toBeVisible();
    await expect(digitain.getByText(/^\s*Resultados\s*$/i).first()).toBeVisible();
  });
});

test('deportes (sin login) - toggle PRE-PARTIDA / EN VIVO es interactivo', { tag: '@prod' }, async ({ page }) => {
  const digitain = page.frameLocator(DIGITAIN_IFRAME_SELECTOR);

  await test.step('Ambos botones del toggle son visibles', async () => {
    await expect(digitain.getByText(/PRE[\s-]*PARTIDA/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(digitain.getByText(/EN\s*VIVO/i).first()).toBeVisible();
  });

  await test.step('Click en EN VIVO no rompe el widget', async () => {
    // No asserteamos el estado interno post-click porque el indicador visual
    // de tab activo es CSS-driven (sin role=tab) y puede variar segun el
    // theme. Lo que validamos es que el click se procese sin throw y que el
    // search siga vivo (sanity check del widget).
    await digitain.getByText(/EN\s*VIVO/i).first().click();
    await expect(
      digitain.getByRole('textbox', { name: /Encuentre su partido/i }),
    ).toBeVisible();
  });
});

test('deportes (sin login) - Bet Slip vacio visible al entrar', { tag: '@prod' }, async ({ page }) => {
  // FIXME: En el viewport por defecto (1280x720) el panel BET SLIP del widget
  // Digitain no se renderiza inline; el widget esta en modo compacto y el
  // betslip se abre via un toggle (referenciado en el iframe como un link
  // 'javascript: ... betslipInstance.onOpenSystemCalc ...'). El texto literal
  // 'BET SLIP' / 'Bet Slip is empty' del plan no aparece en la accessibility
  // tree del iframe al cargar la pagina. Necesita revision del plan: o se
  // aumenta el viewport para forzar modo desktop, o se reescribe el step
  // para abrir el toggle del betslip antes de assertear el mensaje vacio.
  test.fixme();

  const digitain = page.frameLocator(DIGITAIN_IFRAME_SELECTOR);

  await test.step('El panel BET SLIP esta visible', async () => {
    await expect(digitain.getByText(/BET\s*SLIP/i).first()).toBeVisible({ timeout: 30_000 });
  });

  await test.step('Muestra el mensaje de bet slip vacio', async () => {
    const emptyMsg = digitain
      .getByText(/Bet Slip is empty|Please select events to place a bet|seleccion/i)
      .first();
    await expect(emptyMsg).toBeVisible({ timeout: 15_000 });
  });
});

test('deportes (sin login) - search dentro del iframe Digitain acepta input', { tag: '@prod' }, async ({ page }) => {
  const digitain = page.frameLocator(DIGITAIN_IFRAME_SELECTOR);
  const search = digitain.getByRole('textbox', { name: /Encuentre su partido/i });

  await test.step('Tipear "Boca" en el search', async () => {
    await search.click();
    await search.fill('Boca');
    await expect(search).toHaveValue('Boca');
  });
});
