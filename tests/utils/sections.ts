import { expect, Page, Frame } from '@playwright/test';

export interface SectionConfig {
  nombre: string;
  categoryId: number;
  categoryName: string;
  minGames?: number;
}

export const SECCIONES: Record<string, SectionConfig> = {
  tragamonedas: { nombre: 'Tragamonedas', categoryId: 5, categoryName: 'Tragamonedas', minGames: 100 },
  ruletas: { nombre: 'Ruletas', categoryId: 6, categoryName: 'Ruletas', minGames: 3 },
  blackjack: { nombre: 'Blackjack', categoryId: 13, categoryName: 'Blackjack', minGames: 3 },
  zonaBono: { nombre: 'Zona Bono', categoryId: 35, categoryName: 'Zona Bono🎰', minGames: 5 },
  wandaCollection: { nombre: 'Wanda Collection', categoryId: 30, categoryName: 'Wanda Collection 💎', minGames: 5 },
  freeSpins: { nombre: 'Free Spins', categoryId: 32, categoryName: 'Free Spins 🏅', minGames: 10 },
  losMasJugados: { nombre: 'Los mas Jugados', categoryId: 33, categoryName: 'Los mas Jugados 🎲', minGames: 5 },
  bingo: { nombre: 'Bingo', categoryId: 31, categoryName: 'Bingo 🤞', minGames: 3 },
};

export async function navegarASeccion(page: Page, seccion: SectionConfig) {
  const url = `https://pba.sports.bet.ar/casino/index?categoryId=${seccion.categoryId}&categoryName=${encodeURIComponent(seccion.categoryName)}&brandId=-1&brandName=Todos`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(3000);
}

export async function verificarSeccionCargada(page: Page, seccion: SectionConfig) {
  const gameCount = await page.evaluate(() => {
    const els = document.querySelectorAll('span, div');
    for (const el of els) {
      const t = (el.textContent || '').trim();
      const m = t.match(/\((\d+)\s*JUEGOS?\)/i);
      if (m && t.length < 150 && el.children.length < 5) return parseInt(m[1]);
    }
    return -1;
  });

  expect(gameCount, `La seccion ${seccion.nombre} deberia tener juegos`).toBeGreaterThanOrEqual(seccion.minGames ?? 1);
  return gameCount;
}

export async function obtenerInfoPrimerJuego(page: Page): Promise<{ nombre: string; proveedor: string } | null> {
  return page.evaluate(() => {
    // Game cards are div.juego.widthGame with onclick="playGame('ID')"
    const cards = document.querySelectorAll('div.juego');
    for (const card of cards) {
      const img = card.querySelector('img');
      const name = img?.getAttribute('alt');
      if (!name || name.length < 2) continue;

      // Provider name is in a small or span near the game name
      const infoDiv = card.querySelector('.info');
      const providerEl = infoDiv?.querySelector('small') || infoDiv?.firstElementChild;
      const provider = providerEl?.textContent?.trim() || '';
      return { nombre: name, proveedor: provider };
    }
    return null;
  });
}

export async function clickearPrimerJuego(page: Page) {
  // Game cards use onclick handlers: div.juego has playGame('ID')
  // and the "Jugar" link has _openGameClick(...)
  // Use Playwright native click on the first game card for proper event dispatch
  const gameCard = page.locator('div.juego').first();
  const isVisible = await gameCard.isVisible({ timeout: 5000 }).catch(() => false);

  if (isVisible) {
    await gameCard.click();
  } else {
    // Fallback: click first "Jugar" link via evaluate
    const clicked = await page.evaluate(() => {
      const jugarLinks = document.querySelectorAll('a');
      for (const link of jugarLinks) {
        if (link.textContent?.trim() === 'Jugar') {
          link.click();
          return true;
        }
      }
      return false;
    });
    expect(clicked, 'Deberia encontrar un juego para hacer click').toBeTruthy();
  }

  await page.waitForTimeout(5000);
}

export async function verificarCargaJuego(page: Page): Promise<Frame | null> {
  // Games can load in two ways:
  // 1. Navigate to /gameplay URL
  // 2. Open in #iframe-games overlay on same page

  const url = page.url();
  const isGameplayPage = url.includes('gameplay');

  if (!isGameplayPage) {
    // Check for iframe overlay
    const hasGameIframe = await page.evaluate(() => {
      const iframe = document.getElementById('iframe-games') as HTMLIFrameElement;
      if (!iframe) return false;
      const style = getComputedStyle(iframe);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!hasGameIframe) {
      // Wait a bit more - the game might still be loading
      await page.waitForTimeout(5000);
      const urlAfterWait = page.url();
      if (!urlAfterWait.includes('gameplay')) {
        const hasIframeNow = await page.evaluate(() => {
          const iframe = document.getElementById('iframe-games') as HTMLIFrameElement;
          if (!iframe) return false;
          const style = getComputedStyle(iframe);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        if (!hasIframeNow) return null;
      }
    }
  }

  // Wait for game frame with canvas (up to 60 seconds)
  let gameFrame: Frame | undefined;
  for (let i = 0; i < 30; i++) {
    for (const f of page.frames()) {
      if (f === page.mainFrame() || f.url() === 'about:blank') continue;
      try {
        const hasCanvas = await f.evaluate(() => {
          const c = document.querySelector('canvas');
          return c !== null && c.width > 100;
        }).catch(() => false);
        if (hasCanvas) {
          gameFrame = f;
          break;
        }
      } catch { /* frame not ready */ }
    }
    if (gameFrame) break;
    await page.waitForTimeout(2000);
  }

  return gameFrame || null;
}
