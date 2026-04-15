import { expect, Page, Frame } from '@playwright/test';

// ====== Tipos ======

export interface SpinResult {
  spinNumber: number;
  success: boolean;
  winAmount?: number;
  balanceAfter?: number;
  error?: string;
}

export interface SpinsResumen {
  totalSpins: number;
  spinsExitosos: number;
  spinsFallidos: number;
  gananciaTotal: number;
  balanceInicial?: number;
  balanceFinal?: number;
  resultado: 'ganancia' | 'perdida' | 'empate';
  detalle: SpinResult[];
}

export interface SpinButtonConfig {
  xRatio: number;
  yRatio: number;
}

// ====== Búsqueda de juegos ======

export async function abrirBusquedaYBuscarJuego(page: Page, query: string) {
  const searchBtn = page.locator('button.header__icon--search');
  if (await searchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchBtn.click();
  } else {
    await page.evaluate(() => {
      const btn = document.querySelector('button.header__icon--search') as HTMLElement;
      if (btn) btn.click();
    });
  }
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    const modal = document.getElementById('search-modal-games');
    if (modal) {
      modal.style.display = 'block';
      modal.classList.add('show');
    }
  });
  await page.waitForTimeout(500);

  await page.evaluate((q) => {
    const input = document.getElementById('games-search') as HTMLInputElement;
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
  }, query);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/07-search-results.png' });
}

export async function clickearResultadoJuego(page: Page, nombreJuego: string) {
  const navPromise = page.waitForNavigation({ timeout: 15_000 }).catch(() => null);
  await page.evaluate((nombre) => {
    const modal = document.getElementById('search-modal-games');
    if (!modal) return;
    const item = modal.querySelector('li.games-block-recommended__item') as HTMLElement;
    if (item && item.textContent?.includes(nombre)) {
      item.click();
    }
  }, nombreJuego);
  await navPromise;
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/08-after-click.png' });
}

export async function reintentarAbrirJuego(page: Page, query: string) {
  await page.goto('https://pba.sports.bet.ar/casino/index', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    const btn = document.querySelector('button.header__icon--search') as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(1000);

  await page.evaluate((q) => {
    const modal = document.getElementById('search-modal-games');
    if (modal) {
      modal.style.display = 'block';
      modal.classList.add('show');
    }
    const input = document.getElementById('games-search') as HTMLInputElement;
    if (input) {
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('keyup', { bubbles: true }));
    }
  }, query);
  await page.waitForTimeout(2000);

  const onclickInfo = await page.evaluate(() => {
    const modal = document.getElementById('search-modal-games');
    if (!modal) return null;
    const item = modal.querySelector('li.games-block-recommended__item') as HTMLElement;
    if (!item) return null;
    return {
      onclick: item.getAttribute('onclick'),
      outerHTML: item.outerHTML.substring(0, 500),
      dataAttrs: Array.from(item.attributes).map((a) => `${a.name}=${a.value}`),
    };
  });
  console.log('Game item onclick:', JSON.stringify(onclickInfo, null, 2));
}

// ====== Game frame ======

export async function esperarGameFrame(page: Page, framePatterns?: string[]) {
  const patterns = framePatterns || ['caletaholdings', 'chinacharms'];
  let gameFrame: Frame | undefined;

  for (let i = 0; i < 30; i++) {
    // Buscar por patrones específicos primero
    gameFrame = page.frames().find((f) => {
      const url = f.url();
      return patterns.some((p) => url.includes(p));
    });
    // Fallback: buscar cualquier frame con canvas de juego (no el frame principal ni about:blank)
    if (!gameFrame) {
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
    }
    if (gameFrame) break;
    await page.waitForTimeout(1000);
  }
  expect(gameFrame, 'El frame del juego deberia existir').toBeDefined();

  for (let i = 0; i < 15; i++) {
    try {
      const canvasReady = await gameFrame!.evaluate(() => {
        const c = document.querySelector('canvas');
        return c !== null && c.width > 100;
      });
      if (canvasReady) break;
    } catch {
      // Frame may not be ready yet
    }
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/09-game-ready.png' });

  return gameFrame!;
}

async function encontrarCanvasJuego(page: Page, debug = false): Promise<{ frame: Frame; box: { x: number; y: number; width: number; height: number } } | null> {
  const frames = page.frames();
  if (debug) console.log(`[encontrarCanvas] Frames totales: ${frames.length}`);

  for (const f of frames) {
    if (f === page.mainFrame() || f.url() === 'about:blank') continue;
    const url = f.url();
    try {
      // Buscar el mejor canvas: preferir el del juego (no el loader), el más grande
      const bestSelector = await f
        .evaluate(() => {
          const canvases = Array.from(document.querySelectorAll('canvas'));
          if (canvases.length === 0) return null;
          // Filtrar loader canvas y elegir el más grande
          const candidates = canvases
            .filter((c) => c.id !== 'loaderCanvas')
            .sort((a, b) => (b.width * b.height) - (a.width * a.height));
          const best = candidates[0] || canvases[0];
          if (best.width <= 100) return null;
          // Generar un selector específico
          if (best.id) return `#${best.id}`;
          const parent = best.parentElement;
          if (parent?.id) return `#${parent.id} canvas`;
          return `canvas >> nth=${canvases.indexOf(best)}`;
        })
        .catch(() => null);

      if (debug) console.log(`[encontrarCanvas] Frame ${url.substring(0, 80)} -> selector: ${bestSelector}`);

      if (bestSelector) {
        const canvas = f.locator(bestSelector.includes(' >> ') ? bestSelector : `css=${bestSelector}`);
        const box = await canvas.boundingBox();
        if (box) return { frame: f, box };
        if (debug) console.log(`[encontrarCanvas] Canvas encontrado pero boundingBox es null`);
      }
    } catch (e) {
      if (debug) console.log(`[encontrarCanvas] Frame ${url.substring(0, 80)} -> error: ${e}`);
    }
  }
  return null;
}

export async function cerrarIntroJuego(page: Page) {
  // Muchos juegos (Pragmatic Play) muestran una pantalla de intro/features.
  // The intro button (EMPEZAR/START) can be either a DOM overlay or canvas-rendered.

  const canvas = await encontrarCanvasJuego(page);

  if (!canvas) {
    console.log('No se encontró frame con canvas para cerrar intro');
    return;
  }

  const box = canvas.box;
  console.log(`Canvas boundingBox: x=${box.x} y=${box.y} w=${box.width} h=${box.height}`);

  // Strategy 1: Try to find and click DOM-based intro buttons in game frames
  // Pragmatic Play intro buttons ("EMPEZAR", "START") are often DOM overlays
  let introDismissed = false;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const introTexts = ['Empezar', 'EMPEZAR', 'Start', 'START', 'Play', 'PLAY', 'Jugar', 'JUGAR'];
      for (const text of introTexts) {
        const btn = frame.locator(`button:has-text("${text}"), a:has-text("${text}"), div:has-text("${text}"):not(:has(div))`).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`Intro DOM button found: "${text}" — clicking`);
          await btn.click({ timeout: 3000 }).catch(() => {});
          introDismissed = true;
          await page.waitForTimeout(2000);
          break;
        }
      }
      if (introDismissed) break;
    } catch { /* frame might be detached */ }
  }

  if (!introDismissed) {
    // Strategy 2: Click at known positions using both methods (canvas PointerEvents + page.mouse)
    // EMPEZAR button is typically at bottom-center of the canvas (~0.50, 0.89)
    const posiciones = [
      { desc: 'empezar-bottom', xr: 0.50, yr: 0.89 },     // Most common: bottom center
      { desc: 'empezar-bottom-alt', xr: 0.47, yr: 0.88 },  // Slightly left
      { desc: 'empezar-centro', xr: 0.50, yr: 0.80 },
      { desc: 'empezar-centro-alt', xr: 0.50, yr: 0.75 },
      { desc: 'play-btn-right', xr: 0.68, yr: 0.43 },
      { desc: 'centro', xr: 0.50, yr: 0.50 },
      { desc: 'centro-bajo', xr: 0.50, yr: 0.60 },
    ];

    for (const pos of posiciones) {
      console.log(`Click intro: ${pos.desc} -> ratio(${pos.xr}, ${pos.yr})`);
      await clickCanvasDual(page, canvas.frame, box, pos.xr, pos.yr);
      await page.waitForTimeout(1500);
    }
  }

  await page.screenshot({ path: 'test-results/09b-intro-attempt1.png' });
  await page.waitForTimeout(2000);

  // Second round: try DOM buttons again + canvas clicks
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      for (const text of ['Empezar', 'EMPEZAR', 'Start', 'START', 'Aceptar', 'OK']) {
        const btn = frame.locator(`button:has-text("${text}"), a:has-text("${text}"), div:has-text("${text}"):not(:has(div))`).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`Dismissing: "${text}"`);
          await btn.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
        }
      }
    } catch { /* frame detached */ }
  }

  // Canvas click fallback (second round) — target bottom-center where EMPEZAR usually is
  await clickCanvasDual(page, canvas.frame, box, 0.50, 0.89);
  await page.waitForTimeout(1000);
  await clickCanvasDual(page, canvas.frame, box, 0.50, 0.80);
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test-results/09b-intro-closed.png' });

  // Dismiss any "hardware acceleration" or "ADVERTENCIA" dialogs
  await dismissGameDialogs(page);
}

/**
 * Dismiss common game dialogs (hardware acceleration warnings, cookie notices, etc.)
 * These are DOM elements inside the game iframe, not canvas-rendered.
 */
async function dismissGameDialogs(page: Page): Promise<void> {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      // Look for buttons with common dismiss text
      const dismissTexts = ['Aceptar', 'Accept', 'OK', 'Continue', 'Continuar', 'Got it', 'Close'];
      for (const text of dismissTexts) {
        const btn = frame.locator(`button:has-text("${text}"), a:has-text("${text}"), div[role="button"]:has-text("${text}")`).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`Dismissing game dialog: clicking "${text}" in frame`);
          await btn.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1000);
          break;
        }
      }
    } catch { /* frame might be detached */ }
  }
}

// ====== Lectura de datos del juego desde UI ======

function parsearMonto(texto: string): number | undefined {
  // Parsea "1.050,00" o "350,00" o "21.961,00" → número
  // Formato argentino: punto = miles, coma = decimales
  const limpio = texto.replace(/[^\d.,]/g, '');
  if (!limpio) return undefined;
  // Quitar puntos de miles, reemplazar coma decimal por punto
  const normalizado = limpio.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalizado);
  return isNaN(num) ? undefined : num;
}

async function leerDatosDesdeUI(page: Page): Promise<{ winAmount?: number; balance?: number }> {
  // Buscar en todos los frames del juego
  for (const frame of page.frames()) {
    if (frame === page.mainFrame() || frame.url() === 'about:blank') continue;
    try {
      // 1) Buscar en el DOM (texto visible en HTML)
      const domDatos = await frame.evaluate(() => {
        const body = document.body?.innerText || '';
        const ganMatch = body.match(/(?:GANANCIA|PREMIO|WIN)\s+\$?([\d.,]+)/i);
        const credMatch = body.match(/(?:CR[ÉE]DITO|SALDO|BALANCE)\s+\$?([\d.,]+)/i);
        if (ganMatch || credMatch) return { ganancia: ganMatch?.[1] || null, credito: credMatch?.[1] || null };
        return null;
      }).catch(() => null);

      if (domDatos) {
        return {
          winAmount: domDatos.ganancia ? parsearMonto(domDatos.ganancia) : undefined,
          balance: domDatos.credito ? parsearMonto(domDatos.credito) : undefined,
        };
      }

      // 2) Leer textos del engine PixiJS (Pragmatic Play renderiza todo en canvas con PixiJS)
      const pixiDatos = await frame.evaluate(() => {
        function recolectarTextos(obj: any, depth = 0): string[] {
          if (!obj || depth > 30) return [];
          const textos: string[] = [];
          if (typeof obj.text === 'string' && obj.text.length > 0 && obj.visible !== false) {
            textos.push(obj.text);
          }
          if (obj.children && Array.isArray(obj.children)) {
            for (const child of obj.children) {
              textos.push(...recolectarTextos(child, depth + 1));
            }
          }
          return textos;
        }

        const w = window as any;

        // Buscar la app/stage de PIXI por múltiples caminos
        const candidatos: any[] = [];

        // Globals directos
        for (const key of ['__PIXI_APP__', 'app', 'game', 'GAME', '__PIXI_STAGE__', 'stage']) {
          if (w[key]) candidatos.push(w[key]);
        }
        if (w.game?.app) candidatos.push(w.game.app);

        // Buscar en el canvas
        const canvas = document.querySelector('canvas') as any;
        if (canvas) {
          for (const key of Object.getOwnPropertyNames(canvas)) {
            if (key.toLowerCase().includes('pixi') || key.toLowerCase().includes('app')) {
              if (canvas[key] && typeof canvas[key] === 'object') candidatos.push(canvas[key]);
            }
          }
        }

        // Buscar PIXI.Application instances via el renderer del PIXI global
        if (w.PIXI) {
          // PIXI.utils.TextureCache puede tener referencia, pero más fiable:
          // Recorrer todas las propiedades de window buscando objetos con .stage
          for (const key of Object.getOwnPropertyNames(w)) {
            try {
              const val = w[key];
              if (val && typeof val === 'object' && val.stage && val.renderer) {
                candidatos.push(val);
              }
            } catch { /* getter might throw */ }
          }
        }

        const todosTextos: string[] = [];
        for (const app of candidatos) {
          const stage = app.stage || app;
          const textos = recolectarTextos(stage);
          if (textos.length > 0) {
            todosTextos.push(...textos);
            break;
          }
        }

        // PIXI v6/v7: renderer guardado en canvas.__PIXI_RENDERER__
        if (todosTextos.length === 0 && canvas) {
          const renderer = (canvas as any).__PIXI_RENDERER__;
          if (renderer) {
            const root = renderer.lastObjectRendered || renderer._lastObjectRendered;
            if (root) {
              todosTextos.push(...recolectarTextos(root));
            }
          }
        }

        // Buscar en TODAS las propiedades del canvas (incluyendo no-enumerables)
        if (todosTextos.length === 0 && canvas) {
          const allProps = Object.getOwnPropertyNames(canvas).concat(
            Object.getOwnPropertyNames(Object.getPrototypeOf(canvas) || {})
          );
          for (const key of allProps) {
            try {
              const val = (canvas as any)[key];
              if (val && typeof val === 'object') {
                if (val.stage?.children) {
                  todosTextos.push(...recolectarTextos(val.stage));
                  if (todosTextos.length > 0) break;
                }
                if (val.lastObjectRendered?.children) {
                  todosTextos.push(...recolectarTextos(val.lastObjectRendered));
                  if (todosTextos.length > 0) break;
                }
              }
            } catch { /* skip */ }
          }
        }

        // Último recurso: escanear ALL window globals buscando objetos con .stage.children
        if (todosTextos.length === 0 && w.PIXI) {
          const keys = Object.getOwnPropertyNames(w);
          for (const key of keys) {
            try {
              const val = w[key];
              if (val?.stage?.children) {
                todosTextos.push(...recolectarTextos(val.stage));
                if (todosTextos.length > 0) break;
              }
            } catch { /* skip */ }
          }
        }

        if (todosTextos.length === 0) return null;

        let ganancia: string | null = null;
        let credito: string | null = null;

        for (const t of todosTextos) {
          if (/ganancia|premio|win/i.test(t)) {
            const m = t.match(/([\d.,]+)/);
            if (m) ganancia = m[1];
          }
          if (/cr[ée]dito|saldo|balance/i.test(t)) {
            const m = t.match(/([\d.,]+)/);
            if (m) credito = m[1];
          }
        }

        const combinado = todosTextos.join(' ');
        if (!ganancia) {
          const gm = combinado.match(/(?:GANANCIA|PREMIO|WIN)\s+([\d.,]+)/i);
          if (gm) ganancia = gm[1];
        }
        if (!credito) {
          const cm = combinado.match(/(?:CR[ÉE]DITO|SALDO|BALANCE)\s+([\d.,]+)/i);
          if (cm) credito = cm[1];
        }

        return { ganancia, credito, _debug: todosTextos.slice(0, 20) };
      }).catch(() => null);

      if (pixiDatos) {
        if (pixiDatos._debug?.length > 0) {
          console.log(`[PixiJS] Textos encontrados: ${pixiDatos._debug.join(' | ')}`);
        }
        if (pixiDatos.ganancia || pixiDatos.credito) {
          return {
            winAmount: pixiDatos.ganancia ? parsearMonto(pixiDatos.ganancia) : undefined,
            balance: pixiDatos.credito ? parsearMonto(pixiDatos.credito) : undefined,
          };
        }
      }
    } catch { /* frame not accessible */ }
  }

  return {};
}

// ====== Spins ======

/**
 * Click on a canvas inside a game iframe using synthetic PointerEvents.
 * Pragmatic Play (and other canvas-based game engines) listen for PointerEvents
 * directly on the canvas. Playwright's page.mouse.click() may not trigger them
 * properly for cross-origin iframes.
 *
 * Uses RATIOS (0-1) relative to the canvas element, calculated inside the frame's
 * own coordinate system to avoid viewport offset mismatches.
 */
async function clickCanvasPointerEvent(
  frame: Frame,
  xRatio: number,
  yRatio: number,
): Promise<void> {
  await frame.evaluate(({ xr, yr }) => {
    // Find the largest non-loader canvas
    const canvases = Array.from(document.querySelectorAll('canvas'))
      .filter((c) => c.id !== 'loaderCanvas')
      .sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const canvas = canvases[0];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + rect.width * xr;
    const clientY = rect.top + rect.height * yr;

    const common: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: 1,
    };

    canvas.dispatchEvent(new PointerEvent('pointerdown', common));
    canvas.dispatchEvent(new MouseEvent('mousedown', common));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 }));
    canvas.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 }));
  }, { xr: xRatio, yr: yRatio });
}

/**
 * Click on the canvas using both methods: synthetic PointerEvents (for canvas-based engines)
 * AND Playwright's page.mouse.click (for standard event routing).
 */
async function clickCanvasDual(
  page: Page,
  frame: Frame,
  box: { x: number; y: number; width: number; height: number },
  xRatio: number,
  yRatio: number,
): Promise<void> {
  // Method 1: Playwright mouse click at viewport coordinates (trusted events, preferred)
  const vpX = Math.round(box.x + box.width * xRatio);
  const vpY = Math.round(box.y + box.height * yRatio);
  await page.mouse.click(vpX, vpY);
  // Small delay to let the game process the trusted event first
  await page.waitForTimeout(200);
  // Method 2: Synthetic PointerEvents inside the game frame (for canvas engines that need direct events)
  await clickCanvasPointerEvent(frame, xRatio, yRatio);
}

// Pragmatic Play: spin button is a circular button at bottom-right of game area
// (0.75, 0.85) confirmed working for prrplt4 games (Wanda, Medusa Money, Los mas Jugados)
const DEFAULT_SPIN_CONFIG: SpinButtonConfig = { xRatio: 0.75, yRatio: 0.85 };

// Alternative spin button positions for different game providers
const SPIN_BUTTON_ALTERNATIVES: SpinButtonConfig[] = [
  { xRatio: 0.75, yRatio: 0.85 },  // Pragmatic Play prrplt4 (confirmed: Wanda, Los mas Jugados)
  { xRatio: 0.74, yRatio: 0.88 },  // Pragmatic Play prrplt4 (Medusa Money spin btn center)
  { xRatio: 0.70, yRatio: 0.93 },  // Pragmatic Play gs2c (Joker's Jewels — spin button in bottom bar)
  { xRatio: 0.65, yRatio: 0.93 },  // gs2c slightly left
  { xRatio: 0.75, yRatio: 0.90 },  // bottom-right large spin buttons
  { xRatio: 0.50, yRatio: 0.93 },  // bottom center (other providers, low)
  { xRatio: 0.50, yRatio: 0.90 },  // bottom center
  { xRatio: 0.85, yRatio: 0.85 },  // far right bottom
];

export async function ejecutarSpins(page: Page, cantidad: number, spinConfig?: SpinButtonConfig): Promise<SpinsResumen> {
  const config = spinConfig || DEFAULT_SPIN_CONFIG;

  // Esperar a que el canvas del juego esté listo (puede estar cargando)
  let canvasInfo: Awaited<ReturnType<typeof encontrarCanvasJuego>> = null;
  for (let intento = 0; intento < 30; intento++) {
    const debug = intento === 0 || intento === 5 || intento === 15;
    canvasInfo = await encontrarCanvasJuego(page, debug);
    if (canvasInfo) break;
    console.log(`Esperando canvas del juego... (intento ${intento + 1}/30)`);
    await page.waitForTimeout(2000);
  }
  if (!canvasInfo) {
    throw new Error('No se encontró canvas del juego para ejecutar spins después de 60s');
  }

  const { box } = canvasInfo;

  // Dismiss any blocking dialogs before starting spins
  await dismissGameDialogs(page);
  await page.waitForTimeout(2000); // Let game settle after dialog dismissal
  await page.screenshot({ path: 'test-results/09c-pre-spin.png' });

  let activeConfig = config;
  let spinX = Math.round(box.x + box.width * activeConfig.xRatio);
  let spinY = Math.round(box.y + box.height * activeConfig.yRatio);
  console.log(`Spin position: canvas(${box.x},${box.y} ${box.width}x${box.height}) -> click(${spinX}, ${spinY}) [ratio ${activeConfig.xRatio}, ${activeConfig.yRatio}]`);

  // Interceptar respuestas HTTP de la API del juego
  const spinResponses: { url: string; status: number; body: any }[] = [];
  const allResponseUrls: string[] = []; // Debug: track ALL responses during spins
  const responseHandler = async (response: any) => {
    const url: string = response.url();
    // Debug: log all non-static responses from game frames
    if (!url.endsWith('.png') && !url.endsWith('.jpg') && !url.endsWith('.css') &&
        !url.endsWith('.js') && !url.endsWith('.woff') && !url.endsWith('.woff2') &&
        !url.endsWith('.svg') && !url.endsWith('.mp3') && !url.endsWith('.ogg') &&
        !url.endsWith('.webp') && !url.endsWith('.gif') && !url.endsWith('.ico')) {
      allResponseUrls.push(url);
    }
    // Match specific game API endpoints, NOT broad domain patterns.
    // Removed: gs2c, pragmaticplay, prrplt, eubxweikjo (too broad — matches balance checks, promos, etc.)
    const isGameApi =
      url.includes('/spin') || url.includes('/play') || url.includes('/bet') ||
      url.includes('/round') || url.includes('gameService') || url.includes('gameserver') ||
      url.includes('doSpin') || url.includes('/action') || url.includes('/result') ||
      url.includes('evoplay') || url.includes('slotegrator') || url.includes('softswiss') ||
      url.includes('/api/game') || url.includes('amusnet') || url.includes('habanero') ||
      url.includes('wazdan');
    if (!isGameApi) return;
    try {
      const text = await response.text().catch(() => null);
      if (!text) return;
      // Intentar parsear como JSON
      let body: any = null;
      try { body = JSON.parse(text); } catch { /* not JSON */ }
      // Si no es JSON, guardar como texto raw para análisis
      if (body) {
        spinResponses.push({ url, status: response.status(), body });
      } else if (text.length > 10) {
        spinResponses.push({ url, status: response.status(), body: { _raw: text } });
      }
    } catch { /* response not readable */ }
  };
  page.on('response', responseHandler);

  // Interceptar WebSocket via CDP (captura mensajes de conexiones ya existentes)
  const wsMessages: string[] = [];
  let cdpSession: any = null;
  try {
    cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Network.enable');
    cdpSession.on('Network.webSocketFrameReceived', (params: any) => {
      const data = params.response?.payloadData;
      if (typeof data === 'string' && data.length > 10) {
        wsMessages.push(data);
      }
    });
  } catch (e) {
    console.log(`[CDP] No se pudo iniciar sesión CDP: ${e}`);
  }


  const resultados: SpinResult[] = [];
  let spinsExitosos = 0;
  let erroresConsecutivos = 0;
  const MAX_ERRORES_CONSECUTIVOS = 3;

  for (let i = 1; i <= cantidad; i++) {
    if (erroresConsecutivos >= MAX_ERRORES_CONSECUTIVOS) {
      console.log(`Abortando spins: ${MAX_ERRORES_CONSECUTIVOS} errores consecutivos`);
      for (let j = i; j <= cantidad; j++) {
        resultados.push({ spinNumber: j, success: false, error: 'Abortado por errores consecutivos' });
      }
      break;
    }

    const wsCountBefore = wsMessages.length;
    const spinRespCountBefore = spinResponses.length;

    // Click spin y esperar respuesta de la API del juego en paralelo
    const gameServicePromise = page.waitForResponse(
      (resp) => {
        const u = resp.url();
        return u.includes('gameService') || u.includes('/spin') ||
          u.includes('/play') || u.includes('/bet') || u.includes('/round') ||
          u.includes('evoplay') || u.includes('/action') || u.includes('/result') ||
          u.includes('doSpin') || u.includes('slotegrator') || u.includes('/api/game') ||
          u.includes('gameserver');
      },
      { timeout: 5000 },
    ).catch(() => null);

    // Use dual click: synthetic PointerEvents + page.mouse.click (covers all game engines)
    await clickCanvasDual(page, canvasInfo.frame, box, activeConfig.xRatio, activeConfig.yRatio);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/10-spin-${i}-click.png` });

    // Esperar a que termine la animación del spin
    const gameServiceResp = await gameServicePromise;
    await page.waitForTimeout(2000);

    // Verificar si hubo error en el juego
    const errorInfo = await detectarErrorJuego(page);

    if (errorInfo) {
      erroresConsecutivos++;
      console.log(`Spin ${i}: ERROR (${erroresConsecutivos}/${MAX_ERRORES_CONSECUTIVOS}) - ${errorInfo}`);
      resultados.push({ spinNumber: i, success: false, error: errorInfo });

      await manejarErrorJuego(page);
      await page.waitForTimeout(3000);

      for (let w = 0; w < 10; w++) {
        const recovered = await encontrarCanvasJuego(page);
        if (recovered) break;
        await page.waitForTimeout(1000);
      }
    } else {
      // 1) Extraer datos de la respuesta gameService (esperada explícitamente)
      let spinData: { winAmount?: number; balance?: number } = {};
      let src = 'visual';
      if (gameServiceResp) {
        try {
          const text = await gameServiceResp.text();
          if (i === 1) {
            console.log(`[Debug] gameServiceResp URL: ${gameServiceResp.url().substring(0, 100)}`);
            console.log(`[Debug] gameServiceResp text (first 300): ${text.substring(0, 300)}`);
          }
          let body: any = null;
          try { body = JSON.parse(text); } catch { /* not JSON */ }
          if (body) {
            spinData = extraerDatosSpin([{ url: gameServiceResp.url(), status: gameServiceResp.status(), body }]);
            if (spinData.winAmount != null || spinData.balance != null) src = 'HTTP';
          }
          // Si no se parseó como JSON, intentar como texto con formato propietario
          if (spinData.winAmount == null && spinData.balance == null && text.length > 10) {
            spinData = extraerDatosTexto(text);
            if (spinData.winAmount != null || spinData.balance != null) src = 'HTTP-text';
          }
          if (i === 1 && spinData.winAmount == null && spinData.balance == null) {
            console.log(`[Debug] extraerDatosTexto failed on gameServiceResp`);
          }
        } catch (e) {
          if (i === 1) console.log(`[Debug] gameServiceResp read error: ${e}`);
        }
      } else if (i === 1) {
        console.log(`[Debug] gameServicePromise returned null (no matching response in 8s)`);
      }

      // 2) Fallback: otras respuestas HTTP capturadas por responseHandler (ej: pragmaticplay)
      const newSpinResps = spinResponses.slice(spinRespCountBefore);
      if (spinData.winAmount == null && spinData.balance == null && newSpinResps.length > 0) {
        if (i === 1) {
          for (const r of newSpinResps) {
            const raw = r.body?._raw;
            console.log(`[Debug] Accumulated resp: ${r.url.substring(0, 80)} | raw=${raw ? raw.substring(0, 200) : JSON.stringify(r.body).substring(0, 200)}`);
          }
        }
        const httpData = extraerDatosSpin(newSpinResps);
        if (httpData.winAmount != null || httpData.balance != null) {
          spinData = httpData;
          src = 'HTTP-accumulated';
        }
        // Intentar también como texto si hay raw
        if (spinData.winAmount == null && spinData.balance == null) {
          for (const r of newSpinResps) {
            if (r.body?._raw) {
              const textData = extraerDatosTexto(r.body._raw);
              if (i === 1) {
                console.log(`[Debug] extraerDatosTexto result: win=${textData.winAmount} bal=${textData.balance}`);
              }
              if (textData.winAmount != null || textData.balance != null) {
                spinData = textData;
                src = 'HTTP-text-accumulated';
                break;
              }
            }
          }
        }
      }

      // 3) Fallback: WebSocket messages (CDP)
      const newWsMessages = wsMessages.slice(wsCountBefore);
      if (spinData.winAmount == null && spinData.balance == null && newWsMessages.length > 0) {
        const wsData = extraerDatosWs(newWsMessages);
        if (wsData.winAmount != null || wsData.balance != null) {
          spinData = wsData;
          src = 'WS';
        }
      }

      // 4) Fallback: Read data from game UI (PixiJS text objects / DOM)
      if (spinData.winAmount == null && spinData.balance == null) {
        const uiData = await leerDatosDesdeUI(page);
        if (uiData.winAmount != null || uiData.balance != null) {
          spinData = { winAmount: uiData.winAmount, balance: uiData.balance };
          src = 'UI';
        }
      }

      const { winAmount, balance } = { winAmount: spinData.winAmount, balance: spinData.balance };

      erroresConsecutivos = 0;
      spinsExitosos++;
      resultados.push({
        spinNumber: i,
        success: true,
        winAmount,
        balanceAfter: balance,
      });
      console.log(
        `Spin ${i}: OK [${src}] | Ganancia: $${winAmount?.toFixed(2) ?? 'N/A'} | Balance: $${balance?.toFixed(2) ?? 'N/A'}`,
      );

      // Debug: log all HTTP responses captured during first spin
      if (i === 1) {
        console.log(`[Debug] All responses during spin 1: ${allResponseUrls.length}`);
        for (const u of allResponseUrls.slice(-10)) {
          console.log(`  -> ${u.substring(0, 150)}`);
        }
        console.log(`[Debug] Game API responses captured: ${spinResponses.length}`);
        for (const sr of spinResponses) {
          console.log(`  [API] ${sr.url.substring(0, 120)} (${sr.status})`);
        }
        console.log(`[Debug] WS messages: ${wsMessages.length}`);
      }

      // Auto-detect spin button: if first spin produced no data and no custom config,
      // try alternative positions before the next spin
      if (i === 1 && src === 'visual' && !spinConfig) {
        console.log('Spin 1 produced no data — trying alternative spin button positions...');
        // Refresh canvas info in case it changed
        const freshCanvas = await encontrarCanvasJuego(page);
        const altBox = freshCanvas?.box || box;

        for (const alt of SPIN_BUTTON_ALTERNATIVES) {
          const altX = Math.round(altBox.x + altBox.width * alt.xRatio);
          const altY = Math.round(altBox.y + altBox.height * alt.yRatio);
          console.log(`  Trying alt position (${alt.xRatio}, ${alt.yRatio}) -> click(${altX}, ${altY})`);

          const altSpinResps = spinResponses.length;
          const altWsBefore = wsMessages.length;

          const altGamePromise = page.waitForResponse(
            (resp) => {
              const u = resp.url();
              return u.includes('gameService') || u.includes('/spin') || u.includes('/play') ||
                u.includes('/bet') || u.includes('/round') ||
                u.includes('evoplay') || u.includes('/action') || u.includes('/result') ||
                u.includes('gameserver');
            },
            { timeout: 4000 },
          ).catch(() => null);

          await clickCanvasDual(page, canvasInfo.frame, altBox, alt.xRatio, alt.yRatio);
          await page.waitForTimeout(800);

          await altGamePromise;
          await page.waitForTimeout(1500);

          // Check if this position produced REAL game data (not just any HTTP response)
          // Only trust spinResponses (filters for meaningful body >10 chars) and WS messages.
          // Do NOT use altResp alone — broad URL patterns (gs2c, eubxweikjo) match non-spin responses.
          const altNewResps = spinResponses.slice(altSpinResps);
          const altNewWs = wsMessages.slice(altWsBefore);
          const gotData = altNewResps.length > 0 || altNewWs.length > 0;

          if (gotData) {
            activeConfig = alt;
            spinX = altX;
            spinY = altY;
            console.log(`  Found working spin position: (${alt.xRatio}, ${alt.yRatio})`);
            break;
          }
        }

        if (activeConfig === config) {
          console.log('  No alternative position produced data either.');
        }
      }
    }

    await page.screenshot({ path: `test-results/10-spin-${i}-done.png` });
  }

  page.off('response', responseHandler);
  if (cdpSession) {
    await cdpSession.detach().catch(() => {});
  }

  // Construir resumen
  const gananciaTotal = resultados
    .filter((r) => r.success && r.winAmount != null)
    .reduce((sum, r) => sum + (r.winAmount || 0), 0);

  const balanceInicial = resultados.find((r) => r.success)?.balanceAfter != null
    ? (resultados.find((r) => r.success)!.balanceAfter! + gananciaTotal)
    : undefined;
  const balanceFinal = resultados.filter((r) => r.success).slice(-1)[0]?.balanceAfter;

  const resumen: SpinsResumen = {
    totalSpins: cantidad,
    spinsExitosos,
    spinsFallidos: cantidad - spinsExitosos,
    gananciaTotal,
    balanceInicial,
    balanceFinal,
    resultado: gananciaTotal > 0 ? 'ganancia' : gananciaTotal < 0 ? 'perdida' : 'empate',
    detalle: resultados,
  };

  // Log resumen
  console.log('\n====== RESUMEN DE SPINS ======');
  console.log(`Spins ejecutados: ${spinsExitosos}/${cantidad}`);
  console.log(`Ganancia total: $${gananciaTotal.toFixed(2)}`);
  console.log(`Resultado: ${resumen.resultado.toUpperCase()}`);
  if (balanceFinal != null) {
    console.log(`Balance final: $${balanceFinal.toFixed(2)}`);
  }
  console.log('==============================\n');

  return resumen;
}

async function detectarErrorJuego(page: Page): Promise<string | null> {
  // Buscar en todos los frames por overlays de error o modales
  for (const frame of page.frames()) {
    try {
      const error = await frame.evaluate(() => {
        const errorSelectors = [
          '[class*="error"]', '[class*="Error"]', '[id*="error"]',
          '[class*="overlay"]', '[class*="modal"]', '[class*="Modal"]',
          '[class*="dialog"]', '[class*="Dialog"]', '[class*="message"]',
          '[class*="popup"]', '[class*="Popup"]',
        ];
        const errorTexts = [
          'Error', 'error', 'Oops', 'unavailable',
          'Sesión expirada', 'sesión expirada', 'Session expired',
          'session expired', 'Sesion expirada',
          'Volver a cargar', 'Reload',
        ];
        for (const sel of errorSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const text = (el as HTMLElement).innerText || '';
            const isVisible = (el as HTMLElement).offsetParent !== null
              || getComputedStyle(el).display !== 'none';
            if (isVisible && errorTexts.some((t) => text.includes(t))) {
              return text.substring(0, 200);
            }
          }
        }
        // Búsqueda amplia: cualquier elemento visible con texto de error/sesión
        const allElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5');
        for (const el of allElements) {
          const text = (el as HTMLElement).innerText || '';
          if (text.includes('Sesión expirada') || text.includes('Session expired')) {
            const isVisible = (el as HTMLElement).offsetParent !== null
              || getComputedStyle(el).display !== 'none';
            if (isVisible) return `Sesión expirada: ${text.substring(0, 200)}`;
          }
        }
        return null;
      }).catch(() => null);

      if (error) return error;
    } catch {
      // Frame might not be accessible
    }
  }

  // Verificar si la URL cambió (redirección por sesión expirada)
  const url = page.url();
  if (url.includes('login') || url.includes('session') || url.includes('errorpage')) {
    return `Redireccionado a: ${url}`;
  }

  return null;
}

async function manejarErrorJuego(page: Page) {
  for (const frame of page.frames()) {
    try {
      await frame.evaluate(() => {
        const buttons = document.querySelectorAll('button, a');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Volver a cargar') || btn.textContent?.includes('Reload')) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
    } catch {
      // Frame might not be accessible
    }
  }
}

function buscarEnObjeto(obj: any): { win?: number; bal?: number } | null {
  if (!obj || typeof obj !== 'object') return null;
  const win = obj.winAmount ?? obj.win ?? obj.totalWin ?? obj.win_amount ?? obj.payout
    ?? obj.tw ?? obj.aw ?? null;
  const bal = obj.balance ?? obj.playerBalance ?? obj.player_balance ?? obj.credits
    ?? obj.bl ?? obj.ab ?? null;
  if (win != null || bal != null) {
    return {
      win: typeof win === 'number' ? win : undefined,
      bal: typeof bal === 'number' ? bal : undefined,
    };
  }
  return null;
}

function extraerDatosSpin(responses: { url: string; status: number; body: any }[]): {
  winAmount?: number;
  balance?: number;
} {
  for (const resp of responses) {
    const body = resp.body;
    if (!body || typeof body !== 'object') continue;

    // Buscar en top-level
    const top = buscarEnObjeto(body);
    if (top) return { winAmount: top.win, balance: top.bal };

    // Buscar en nested objects comunes
    for (const key of ['data', 'result', 'response', 'spin', 'game']) {
      const nested = body[key];
      const found = buscarEnObjeto(nested);
      if (found) return { winAmount: found.win, balance: found.bal };
    }

    // Pragmatic Play: buscar recursivamente en sub-objetos (hasta 3 niveles)
    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'object' && body[key] !== null) {
        const found = buscarEnObjeto(body[key]);
        if (found) return { winAmount: found.win, balance: found.bal };
        // Go one level deeper (e.g., data.player.balance)
        for (const subKey of Object.keys(body[key])) {
          if (typeof body[key][subKey] === 'object' && body[key][subKey] !== null) {
            const deep = buscarEnObjeto(body[key][subKey]);
            if (deep) return { winAmount: deep.win, balance: deep.bal };
          }
        }
      }
    }
  }
  return {};
}

function parsearMontoGameService(valor: string): number | undefined {
  // Formato Pragmatic Play: "10,621.00" (coma=miles, punto=decimal) o "280.00"
  const limpio = valor.replace(/,/g, '');
  const num = parseFloat(limpio);
  return isNaN(num) ? undefined : num;
}

function extraerDatosTexto(text: string): { winAmount?: number; balance?: number } {
  // Pragmatic Play usa formato query-string: tw=280.00&balance=10,621.00&...
  let winAmount: number | undefined;
  let balance: number | undefined;

  // tw = total win
  const twMatch = text.match(/(?:^|&)tw=([\d,.]+)/);
  if (twMatch) winAmount = parsearMontoGameService(twMatch[1]);

  // balance o balance_cash
  const balMatch = text.match(/(?:^|&)balance=([\d,.]+)/);
  if (balMatch) balance = parsearMontoGameService(balMatch[1]);

  // Fallback: otros campos
  if (winAmount == null) {
    const winMatch = text.match(/(?:^|&)(?:win|totalWin|winAmount)=([\d,.]+)/);
    if (winMatch) winAmount = parsearMontoGameService(winMatch[1]);
  }
  if (balance == null) {
    const blMatch = text.match(/(?:^|&)(?:bl|ab|credit|balance_cash)=([\d,.]+)/);
    if (blMatch) balance = parsearMontoGameService(blMatch[1]);
  }

  return { winAmount, balance };
}

function extraerDatosWs(messages: string[]): { winAmount?: number; balance?: number } {
  for (const msg of messages) {
    try {
      const parsed = JSON.parse(msg);
      if (typeof parsed === 'object' && parsed !== null) {
        // Buscar en top-level
        const top = buscarEnObjeto(parsed);
        if (top) return { winAmount: top.win, balance: top.bal };

        // Buscar en nested
        for (const key of Object.keys(parsed)) {
          if (typeof parsed[key] === 'object' && parsed[key] !== null) {
            const found = buscarEnObjeto(parsed[key]);
            if (found) return { winAmount: found.win, balance: found.bal };
          }
        }
      }
    } catch {
      // WS message might not be JSON — try regex for common patterns
      const balMatch = msg.match(/["\s](?:balance|bl|ab)["\s:=]+(\d+(?:\.\d+)?)/i);
      const winMatch = msg.match(/["\s](?:win|tw|aw|totalWin)["\s:=]+(\d+(?:\.\d+)?)/i);
      if (balMatch || winMatch) {
        return {
          winAmount: winMatch ? parseFloat(winMatch[1]) : undefined,
          balance: balMatch ? parseFloat(balMatch[1]) : undefined,
        };
      }
    }
  }
  return {};
}
