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

test('casino - grid y contador de juegos visibles', async ({ page }) => {
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

test('casino - categorias visibles y filtrado por Tragamonedas', async ({ page }) => {
  // Los botones de categoria tienen accessible-name "<nombre> icon <nombre>"
  // (el span del icono y el span del texto contribuyen ambos al accessible-name).
  const categoryButton = (name: string) =>
    page.getByRole('button', { name: new RegExp(`^${name} icon ${name}$`, 'i') });

  await test.step('Categorias clave estan visibles', async () => {
    await expect(categoryButton('Drops And Wins')).toBeVisible();
    await expect(categoryButton('Casino en Vivo')).toBeVisible();
    await expect(categoryButton('Juegos de Paño')).toBeVisible();
    await expect(categoryButton('Tragamonedas')).toBeVisible();
    await expect(categoryButton('Ruletas')).toBeVisible();
    await expect(categoryButton('Blackjack')).toBeVisible();
  });

  await test.step('Click en Tragamonedas actualiza el heading del grid', async () => {
    await categoryButton('Tragamonedas').click();
    const heading = page.getByRole('heading', {
      level: 2,
      name: /Tragamonedas \(\d+ juegos\)/i,
    });
    await expect(heading).toBeVisible();
    const n = Number(((await heading.textContent()) ?? '').replace(/[^\d]/g, ''));
    expect(n).toBeGreaterThan(0);
  });
});

test('casino - boton "Ver más" carga juegos adicionales', async ({ page }) => {
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

test('casino - boton "Buscar juegos" abre input y filtra por nombre', async ({ page }) => {
  await test.step('Click en "Buscar juegos" muestra el input enfocado', async () => {
    await page.getByRole('button', { name: /^Buscar juegos$/i }).click();
    const searchInput = page.getByRole('textbox', { name: /ingresar b[uú]squeda/i });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
  });

  await test.step('Tipear "Sweet Bonanza" filtra el grid', async () => {
    const searchInput = page.getByRole('textbox', { name: /ingresar b[uú]squeda/i });
    await searchInput.fill('Sweet Bonanza');
    // El grid filtra client-side; esperamos que al menos un card con titulo
    // que contenga "Sweet Bonanza" siga visible.
    const matching = page.getByRole('heading', { level: 3, name: /Sweet Bonanza/i });
    await expect(matching.first()).toBeVisible({ timeout: 15_000 });
  });
});

test('casino - boton "Buscar por proveedor" abre el listado de providers', async ({ page }) => {
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
