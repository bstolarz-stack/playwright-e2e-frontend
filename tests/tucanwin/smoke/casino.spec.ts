import { test, expect } from '@playwright/test';
import { TUCANWIN_BASE_URL } from '../utils/auth';

/**
 * Smoke UI - Casino de TucanWin (nuevo frontend).
 * Cobertura: GPX-5804.
 *
 * Plan: tests/tucanwin/smoke.plan.md (suite "casino").
 * No requiere usuario logueado.
 */

test.beforeEach(async ({ page }) => {
  await page.goto(`${TUCANWIN_BASE_URL}/casino`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });

  const countdownClose = page.getByRole('button', { name: /cerrar countdown/i });
  if (await countdownClose.isVisible().catch(() => false)) {
    await countdownClose.click().catch(() => {});
  }
});

test('casino - grid y contador de juegos visibles (sin login)', async ({ page }) => {
  await test.step('URL y heading principal con N > 0', async () => {
    expect(page.url()).toContain('/casino');
    const heading = page.getByRole('heading', { name: /Todos los juegos \(\d+ juegos\)/i });
    await expect(heading).toBeVisible();
    const headingText = (await heading.textContent()) ?? '';
    const n = Number(headingText.replace(/[^\d]/g, ''));
    expect(n).toBeGreaterThan(0);
  });

  await test.step('Grid muestra al menos 20 tarjetas de juego', async () => {
    // Cada card tiene un h3 con el nombre del juego dentro del grid.
    const cards = page.getByRole('heading', { level: 3 });
    expect(await cards.count()).toBeGreaterThanOrEqual(20);
  });

  await test.step('Boton "Ver más" visible al pie del grid', async () => {
    await expect(page.getByRole('button', { name: /^Ver m[aá]s$/i })).toBeVisible();
  });
});

test('casino - categorias visibles y filtrado por Tragamonedas (sin login)', async ({ page }) => {
  // En UAT el accessible-name es "<nombre> icon <nombre>" (icon span + label
  // span contribuyen ambos al name). En PROD puede no haber doubled name y
  // los nombres pueden variar (ej. "Casino en Vivo" vs "Casino Vivo"). Por
  // eso matcheamos por inclusion del label en el name del role=button.
  const categoryButton = (label: RegExp) => page.getByRole('button', { name: label });

  await test.step('Categorias clave estan visibles', async () => {
    // "Casino en Vivo" existe como categoria en UAT pero no en PROD (en PROD
    // se accede via /live-casino). "Juegos de Pano" idem. Asseramos solo las
    // categorias que estan en ambos entornos.
    await expect(categoryButton(/Drops\s+And\s+Wins/i)).toBeVisible();
    await expect(categoryButton(/Tragamonedas/i)).toBeVisible();
    await expect(categoryButton(/Ruletas/i)).toBeVisible();
    await expect(categoryButton(/Blackjack/i)).toBeVisible();
  });

  await test.step('Click en Tragamonedas actualiza el heading del grid', async () => {
    await categoryButton(/^(Tragamonedas( icon Tragamonedas)?|Tragamonedas)$/i).first().click();
    const heading = page.getByRole('heading', {
      level: 2,
      name: /Tragamonedas \(\d+ juegos\)/i,
    });
    await expect(heading).toBeVisible();
    const n = Number(((await heading.textContent()) ?? '').replace(/[^\d]/g, ''));
    expect(n).toBeGreaterThan(0);
  });
});

test('casino - boton "Ver más" carga juegos adicionales (sin login)', async ({ page }) => {
  // El contador esta en un nodo de texto suelto del tipo
  // "Mostrando X de Y juegos". Lo localizamos por regex.
  const counter = page.getByText(/Mostrando\s+\d+\s+de\s+\d+\s+juegos/i);
  const readShowing = async () => {
    const txt = (await counter.textContent()) ?? '';
    const match = txt.match(/Mostrando\s+(\d+)\s+de\s+(\d+)/i);
    if (!match) throw new Error(`Counter text not parseable: "${txt}"`);
    return { shown: Number(match[1]), total: Number(match[2]) };
  };

  let initial: { shown: number; total: number };
  await test.step('Contador inicial muestra 20 de Y', async () => {
    await expect(counter).toBeVisible();
    initial = await readShowing();
    expect(initial.shown).toBe(20);
    expect(initial.total).toBeGreaterThan(initial.shown);
  });

  await test.step('Click en "Ver más" aumenta la cantidad mostrada', async () => {
    await page.getByRole('button', { name: /^Ver m[aá]s$/i }).click();
    await expect
      .poll(async () => (await readShowing()).shown, { timeout: 15_000 })
      .toBeGreaterThan(initial.shown);
  });
});

test('casino - boton "Buscar juegos" abre input y filtra por nombre (sin login)', async ({ page }) => {
  // En UAT el input tiene accessible-name "Ingresar busqueda". En PROD puede
  // no tenerlo. Como fallback localizamos cualquier textbox que se haga
  // visible despues del click.
  const searchInput = page
    .getByRole('textbox', { name: /ingresar b[uú]squeda/i })
    .or(page.getByRole('textbox').last());

  await test.step('Click en "Buscar juegos" muestra el input', async () => {
    await page.getByRole('button', { name: /^Buscar juegos$/i }).click();
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 });
  });

  await test.step('Tipear "Sweet Bonanza" filtra el grid', async () => {
    await searchInput.first().fill('Sweet Bonanza');
    // El grid filtra client-side; esperamos que al menos un card con titulo
    // que contenga "Sweet Bonanza" siga visible.
    const matching = page.getByRole('heading', { level: 3, name: /Sweet Bonanza/i });
    await expect(matching.first()).toBeVisible({ timeout: 15_000 });
  });
});

test('casino - boton "Buscar por proveedor" abre el listado de providers (sin login)', async ({ page }) => {
  // Antes del click contamos cuantas menciones de providers conocidos ya hay
  // en la pagina (cada game card muestra el provider, asi que el baseline > 0).
  // Despues del click esperamos que la cantidad aumente — el panel de
  // providers agrega nuevas filas con los nombres.
  const providerNames = page.getByText(/PragmaticPlay|^Ruby$|Evolution|Mascot Gaming/);
  const before = await providerNames.count();

  await page.getByRole('button', { name: /^Buscar por proveedor$/i }).click();

  await expect
    .poll(async () => providerNames.count(), { timeout: 15_000 })
    .toBeGreaterThan(before);
});
